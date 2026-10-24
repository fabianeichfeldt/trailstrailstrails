/**
 * Logic for import-external-trails.js: imports a trail-scraper import.json into public.spot_gpx_trails.
 * Only I/O: fs (the import file's GPX) and global fetch (Supabase REST + storage). Dry run does GETs only.
 */
const fs = require('fs');
const path = require('path');
const { rewriteGpxHeader } = require('./gpx-header');

const DIFFICULTIES = ['green', 'blue', 'red', 'black', 'double-black'];
const DIRECTIONS = ['cw', 'ccw', 'one-way-down', 'one-way-up', 'both'];
const DEFAULT_DIRECTION = 'one-way-down';
const EPSILON_M = 4;          // RDP tolerance, same as preprocess-gpx.js
const SAME_TRACK_MEAN_M = 25; // symmetric mean distance below which two tracks count as the same trail
const COLS = 'id,spot_id,name,difficulty,direction,source,source_id,sort_order,gpx_points';

// ── GPX → thinned points + stats (mirrors preprocess-gpx.js, but per <trkseg>) ───────────────

function parseGpxSegments(content) {
  const segs = [];
  const segRe = /<trkseg\b[^>]*>([\s\S]*?)<\/trkseg>/g;
  const ptRe = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>|<trkpt\b([^>]*)\/>/g;
  let sm;
  while ((sm = segRe.exec(content)) !== null) {
    const pts = [];
    let m;
    ptRe.lastIndex = 0;
    while ((m = ptRe.exec(sm[1])) !== null) {
      const attrs = m[1] ?? m[3];
      const lat = attrs.match(/lat="([^"]+)"/), lon = attrs.match(/lon="([^"]+)"/);
      if (!lat || !lon) continue;
      const ele = m[2] ? m[2].match(/<ele>([^<]+)<\/ele>/) : null;
      pts.push({ lat: parseFloat(lat[1]), lng: parseFloat(lon[1]), alt: ele ? parseFloat(ele[1]) : null });
    }
    if (pts.length) segs.push(pts);
  }
  return segs;
}

function perpDistMeters(p, a, b) {
  const cos = Math.cos(a.lat * Math.PI / 180);
  const px = (p.lng - a.lng) * 111000 * cos, py = (p.lat - a.lat) * 111000;
  const dx = (b.lng - a.lng) * 111000 * cos, dy = (b.lat - a.lat) * 111000;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  return Math.hypot(px - t * dx, py - t * dy);
}

function rdp(points, epsilon) {
  if (points.length <= 2) return points;
  let maxD = 0, maxI = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const d = perpDistMeters(points[i], points[0], points[last]);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD <= epsilon) return [points[0], points[last]];
  return rdp(points.slice(0, maxI + 1), epsilon).slice(0, -1).concat(rdp(points.slice(maxI), epsilon));
}

function segLengthM(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    d += Math.hypot((pts[i].lat - pts[i - 1].lat) * 111000,
      (pts[i].lng - pts[i - 1].lng) * 111000 * Math.cos(pts[i].lat * Math.PI / 180));
  }
  return d;
}

/** GPX text -> { thinnedSegments, gpx_points, distance_km, hasElevation } or null when no track points. */
function processGpxContent(content) {
  const segs = parseGpxSegments(content);
  if (!segs.length) return null;
  const thinnedSegments = segs.map(s => rdp(s, EPSILON_M));
  const hasElevation = segs.flat().some(p => p.alt !== null);
  const gpx_points = thinnedSegments.flat().map(p => [
    Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6, p.alt ?? 0]);
  const distM = thinnedSegments.reduce((s, seg) => s + segLengthM(seg), 0);
  return { thinnedSegments, gpx_points, distance_km: Math.round(distM / 100) / 10, hasElevation };
}

// ── Similarity ────────────────────────────────────────────────────────────────────────────

function normName(s) {
  return String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Vertices plus interpolated points every ~stepM, so sparse thinned tracks compare fairly. */
function densify(lines, stepM = 10) {
  const out = [];
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      out.push(line[i]);
      if (i === line.length - 1) break;
      const a = line[i], b = line[i + 1];
      const n = Math.floor(segLengthM([a, b]) / stepM);
      for (let k = 1; k <= n; k++) {
        const t = k / (n + 1);
        out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
      }
    }
  }
  return out;
}

function meanDistToLines(points, lines) {
  if (!points.length) return Infinity;
  let sum = 0;
  for (const p of points) {
    let best = Infinity;
    for (const line of lines) {
      if (line.length === 1) best = Math.min(best, perpDistMeters(p, line[0], line[0]));
      for (let i = 1; i < line.length; i++) best = Math.min(best, perpDistMeters(p, line[i - 1], line[i]));
    }
    sum += best;
  }
  return sum / points.length;
}

/** Symmetric mean distance (metres) between two sets of polylines; Infinity when either is empty. */
function trackDistanceM(linesA, linesB) {
  return Math.max(meanDistToLines(densify(linesA), linesB), meanDistToLines(densify(linesB), linesA));
}

const rowLine = row => (Array.isArray(row.gpx_points) ? [row.gpx_points.map(p => ({ lat: p[0], lng: p[1] }))] : []);

// ── Classification + conflicts ────────────────────────────────────────────────────────────

/** Returns { action: 'process' } or { action: 'skip'|'removed', reason }. Also normalises direction. */
function classifyEntry(e) {
  if (e.change === 'removed') return { action: 'removed' };
  if (!e.spot_id) return { action: 'skip', reason: 'no spot' };
  if (!DIFFICULTIES.includes(e.difficulty)) return { action: 'skip', reason: 'no difficulty' };
  const direction = e.direction || DEFAULT_DIRECTION;
  if (!DIRECTIONS.includes(direction)) return { action: 'skip', reason: `invalid direction "${e.direction}"` };
  return { action: 'process', direction };
}

/** Existing row this entry collides with, or null. `lines` = entry polylines. */
function findConflict(entry, source, lines, rows) {
  const bySource = rows.find(r => r.source === source && r.source_id === entry.source_id);
  if (bySource) return { kind: 'source_id', row: bySource };
  const n = normName(entry.name);
  const handMade = rows.filter(r => !r.source && r.spot_id === entry.spot_id);
  const byName = n && handMade.find(r => normName(r.name) === n);
  if (byName) return { kind: 'name', row: byName };
  for (const r of handMade) {
    const d = trackDistanceM(lines, rowLine(r));
    if (d < SAME_TRACK_MEAN_M) return { kind: 'geometry', row: r, meanDistanceM: Math.round(d) };
  }
  return null;
}

// ── Supabase I/O ──────────────────────────────────────────────────────────────────────────

const headers = (cfg, extra = {}) => ({ apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, ...extra });

async function check(res, what) {
  if (!res.ok) throw new Error(`${what} failed (${res.status}): ${await res.text()}`);
  return res;
}

async function fetchExisting(cfg, spotIds, source) {
  const byId = new Map();
  const add = rows => rows.forEach(r => byId.set(r.id, r));
  for (let i = 0; i < spotIds.length; i += 40) {
    const ids = spotIds.slice(i, i + 40).map(encodeURIComponent).join(',');
    const res = await check(await fetch(`${cfg.supabaseUrl}/rest/v1/spot_gpx_trails?select=${COLS}&spot_id=in.(${ids})`,
      { headers: headers(cfg) }), 'read spot_gpx_trails');
    add(await res.json());
  }
  const res = await check(await fetch(`${cfg.supabaseUrl}/rest/v1/spot_gpx_trails?select=${COLS}&source=eq.${encodeURIComponent(source)}`,
    { headers: headers(cfg) }), 'read spot_gpx_trails by source');
  add(await res.json());
  return [...byId.values()];
}

const safeFilename = s => s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');

// Same storage layout as the SpotManager (Api.ts uploadGpx): <spotId>/trails/<file>.
async function uploadGpx(cfg, spotId, filename, content) {
  const p = `${spotId}/trails/${filename}`;
  const url = `${cfg.supabaseUrl}/storage/v1/object/gpx-files/${p}`;
  const h = headers(cfg, { 'Content-Type': 'application/gpx+xml' });
  let res = await fetch(url, { method: 'POST', headers: h, body: content });
  if (!res.ok) res = await check(await fetch(url, { method: 'PUT', headers: h, body: content }), 'GPX upload');
  return `${cfg.supabaseUrl}/storage/v1/object/public/gpx-files/${p}`;
}

// ── Import run ────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} importPath path to import.json
 * @param {{apply?: boolean, supabaseUrl: string, serviceKey: string}} cfg
 * @returns report object (see formatReport)
 */
async function runImport(importPath, cfg) {
  const file = JSON.parse(fs.readFileSync(importPath, 'utf8'));
  const baseDir = path.dirname(importPath);
  const report = { source: file.source, apply: !!cfg.apply, inserted: [], replaced: [], skipped: {}, conflicts: [], removed: [], failed: [], spotIds: new Set() };
  const skip = (reason, e) => (report.skipped[reason] ??= []).push(e.name);

  const todo = [];
  for (const e of file.entries ?? []) {
    const c = classifyEntry(e);
    if (c.action === 'removed') report.removed.push(e.name);
    else if (c.action === 'skip') skip(c.reason, e);
    else todo.push({ e, direction: c.direction });
  }
  if (!todo.length) return report;

  const spotIds = [...new Set(todo.map(t => t.e.spot_id))];
  const rows = await fetchExisting(cfg, spotIds, file.source);
  const maxSort = new Map();
  for (const r of rows) maxSort.set(r.spot_id, Math.max(maxSort.get(r.spot_id) ?? -1, r.sort_order ?? -1));

  for (const { e, direction } of todo) {
    try {
      const gpxPath = path.resolve(baseDir, e.gpx ?? '');
      if (!e.gpx || !fs.existsSync(gpxPath)) { skip('gpx file missing', e); continue; }
      const content = fs.readFileSync(gpxPath, 'utf8');
      const proc = processGpxContent(content);
      if (!proc) { skip('gpx has no track points', e); continue; }

      const conflict = findConflict(e, file.source, proc.thinnedSegments, rows);
      const decision = e.on_conflict === 'replace' ? 'replace' : 'skip';
      // "unchanged" = dataset unchanged since the last build, not "imported": only a row with our source_id proves that.
      if (e.change === 'unchanged' && conflict?.kind === 'source_id' && decision === 'skip') { skip('unchanged, already imported', e); continue; }
      if (conflict) {
        report.conflicts.push({ name: e.name, kind: conflict.kind, existingId: conflict.row.id, existingName: conflict.row.name,
          meanDistanceM: conflict.meanDistanceM, decision });
        if (decision === 'skip') continue;
      }

      const filename = `${safeFilename(e.name) || 'trail'}_${safeFilename(e.source_id).slice(0, 8)}.gpx`;
      const stats = { distance_km: proc.distance_km, elevation_gain: null, elevation_loss: null, gpx_points: proc.gpx_points };
      let gpx_url = null;
      if (cfg.apply) gpx_url = await uploadGpx(cfg, e.spot_id, filename, rewriteGpxHeader(content, e.name));

      if (conflict) {
        const patch = { ...stats, filename, gpx_url, spot_id: e.spot_id, name: e.name, difficulty: e.difficulty, direction,
          source: file.source, source_id: e.source_id };
        if (cfg.apply) {
          await check(await fetch(`${cfg.supabaseUrl}/rest/v1/spot_gpx_trails?id=eq.${conflict.row.id}`,
            { method: 'PATCH', headers: headers(cfg, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(patch) }),
          `replace ${e.name}`);
        }
        Object.assign(conflict.row, { source: file.source, source_id: e.source_id });
        report.replaced.push({ name: e.name, id: conflict.row.id });
      } else {
        const sort_order = (maxSort.get(e.spot_id) ?? -1) + 1;
        maxSort.set(e.spot_id, sort_order);
        const row = { ...stats, spot_id: e.spot_id, name: e.name, filename, difficulty: e.difficulty, direction, gpx_url,
          sort_order, source: file.source, source_id: e.source_id };
        let id = null;
        if (cfg.apply) {
          const res = await check(await fetch(`${cfg.supabaseUrl}/rest/v1/spot_gpx_trails`,
            { method: 'POST', headers: headers(cfg, { 'Content-Type': 'application/json', Prefer: 'return=representation' }), body: JSON.stringify(row) }),
          `insert ${e.name}`);
          id = (await res.json())?.[0]?.id ?? null;
          rows.push({ ...row, id });
        }
        report.inserted.push({ name: e.name, id });
      }
      report.spotIds.add(e.spot_id);
    } catch (err) {
      report.failed.push({ name: e.name, error: err.message });
    }
  }
  return report;
}

// ── Report ────────────────────────────────────────────────────────────────────────────────

function formatReport(r) {
  const would = r.apply ? '' : 'would be ';
  const L = [`External trail import "${r.source}" ${r.apply ? '(APPLIED)' : '(DRY RUN, nothing written; use --apply)'}`, ''];
  const list = names => names.map(n => `    - ${n}`);
  L.push(`Inserted: ${r.inserted.length}${r.apply ? '' : ' (would insert)'}`, ...list(r.inserted.map(i => i.name)));
  L.push(`Replaced: ${r.replaced.length}${r.apply ? '' : ' (would replace)'}`, ...list(r.replaced.map(i => `${i.name} (row ${i.id})`)));
  const skipped = Object.entries(r.skipped);
  L.push(`Skipped: ${skipped.reduce((s, [, v]) => s + v.length, 0)}`);
  for (const [reason, names] of skipped) L.push(`  ${reason}: ${names.length}`, ...list(names));
  L.push(`Conflicts: ${r.conflicts.length}`);
  for (const c of r.conflicts) {
    const how = { source_id: 'same source_id', name: 'same name as hand-uploaded track', geometry: `same geometry as hand-uploaded track (mean ${c.meanDistanceM} m)` }[c.kind];
    L.push(`    - "${c.name}" vs existing "${c.existingName}" (row ${c.existingId}): ${how} -> ${c.decision === 'replace' ? `${would}replaced` : `${would}skipped`}`);
  }
  L.push(`Removed from source (check approval!): ${r.removed.length}`, ...list(r.removed));
  if (r.failed.length) L.push(`Failed: ${r.failed.length}`, ...list(r.failed.map(f => `${f.name}: ${f.error}`)));
  if ((r.inserted.length || r.replaced.length)) {
    // ROW_IDS keeps the DEM backfill off hand-made tracks on the same spot.
    const ids = [...r.inserted, ...r.replaced].map(i => i.id).filter(Boolean);
    L.push('', 'Elevation is empty for imported rows. Backfill from the DEM, only these rows:',
      ids.length ? `  ROW_IDS=${ids.join(',')} npm run backfill-dem-elevation-dry   # then without -dry` : '  (row ids known after --apply)');
  }
  return L.join('\n');
}

module.exports = { DIFFICULTIES, DIRECTIONS, normName, processGpxContent, trackDistanceM, classifyEntry, findConflict, runImport, formatReport };
