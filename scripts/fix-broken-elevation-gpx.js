#!/usr/bin/env node
/**
 * fix-broken-elevation-gpx.js
 *
 * One-off remediation for trails whose elevation was silently zeroed by the
 * bug fixed in app/spot_manager/DemElevation.ts + GpxProcessor.ts (see that
 * commit for the root cause): Open Topo Data returned elevation: null for
 * some/all points in a request, Math.round(null) === 0, and processGpx()
 * additionally never baked DEM-corrected elevation into the .gpx file
 * actually stored in Supabase Storage — only into the DB columns.
 *
 * This script re-runs the (now-fixed) DEM-correction + RDP-thinning +
 * GPX-rebuild pipeline against the *currently stored* gpx_url content for
 * each targeted row, and overwrites BOTH:
 *   - the .gpx file in Storage at the row's existing gpx_url path
 *   - the row's gpx_points / distance_km / elevation_gain / elevation_loss
 *
 * ⚠️  DANGER — overwrites production data. Run `npm run backup` first and
 * review a DRY_RUN=1 pass before running for real.
 *
 * Required env vars:
 *   SUPABASE_URL          e.g. https://ixafegmxkadbzhxmepsd.supabase.co
 *   SUPABASE_SERVICE_KEY  service_role key (bypasses RLS)
 *   SPOT_IDS              comma-separated spot_id(s) to fix — deliberately
 *                          required (no "fix everything" default) to keep
 *                          this targeted to spots known to be affected.
 *
 * Optional env vars:
 *   DATASET   Open Topo Data dataset (default: eudem25m)
 *
 * Usage:
 *   DRY_RUN=1 SPOT_IDS=<id1>,<id2> node --env-file=.env fix-broken-elevation-gpx.js
 *   SPOT_IDS=<id1>,<id2> node --env-file=.env fix-broken-elevation-gpx.js
 */

const DRY_RUN = process.env.DRY_RUN === '1';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const SPOT_IDS      = (process.env.SPOT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const DATASET       = process.env.DATASET || 'eudem25m';

if (!SUPABASE_URL) { console.error('Missing env: SUPABASE_URL'); process.exit(1); }
if (!SERVICE_KEY)  { console.error('Missing env: SUPABASE_SERVICE_KEY'); process.exit(1); }
if (!SPOT_IDS.length) { console.error('Missing env: SPOT_IDS (comma-separated spot_id list)'); process.exit(1); }

const TABLES = ['spot_gpx_trails', 'spot_gpx_tours'];
const CHUNK_SIZE = 100;          // Open Topo Data max locations/request
const MIN_REQUEST_GAP_MS = 1100; // stay under ~1 req/sec
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 1500;
const EPSILON_M = 0.5;           // same RDP epsilon as GpxProcessor.ts

function restHeaders() {
  return { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── DEM elevation lookup (mirrors the fixed app/spot_manager/DemElevation.ts) ──

let lastRequestAt = 0;

async function requestChunk(latLngs) {
  const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const locations = latLngs.map(([lat, lng]) => `${lat},${lng}`).join('|');
  const res = await fetch(`https://api.opentopodata.org/v1/${DATASET}?locations=${locations}`);
  if (!res.ok) throw new Error(`Open Topo Data request failed (${res.status})`);
  const data = await res.json();
  if (data.status !== 'OK') throw new Error(`Open Topo Data error: ${JSON.stringify(data)}`);
  return data.results.map(r => {
    if (typeof r.elevation !== 'number' || !Number.isFinite(r.elevation)) {
      throw new Error('Open Topo Data returned no elevation for a location (outside dataset coverage?)');
    }
    return r.elevation;
  });
}

async function fetchChunk(latLngs) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await requestChunk(latLngs);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BACKOFF_MS);
    }
  }
  throw lastErr;
}

async function fetchDemElevations(latLngs) {
  const out = [];
  for (let i = 0; i < latLngs.length; i += CHUNK_SIZE) {
    out.push(...(await fetchChunk(latLngs.slice(i, i + CHUNK_SIZE))));
  }
  return out;
}

// ── GPX parse / thin / rebuild (mirrors app/spot_manager/GpxProcessor.ts) ──────

function parseGpx(content) {
  const nameMatch = content.match(/<name>([^<]*)<\/name>/);
  const name = nameMatch ? nameMatch[1].trim() : '';
  const points = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const latM = m[1].match(/lat="([^"]+)"/);
    const lonM = m[1].match(/lon="([^"]+)"/);
    if (!latM || !lonM) continue;
    const eleM  = m[2].match(/<ele>([^<]+)<\/ele>/);
    const timeM = m[2].match(/<time>([^<]+)<\/time>/);
    const parsedTime = timeM ? new Date(timeM[1]) : null;
    points.push({
      lat:  parseFloat(latM[1]),
      lng:  parseFloat(lonM[1]),
      alt:  eleM ? parseFloat(eleM[1]) : 0,
      time: parsedTime && !isNaN(parsedTime.getTime()) ? parsedTime : null,
    });
  }
  return { name, points };
}

function perpDistMeters(p, a, b) {
  const cos = Math.cos(a.lat * Math.PI / 180);
  const px = (p.lng - a.lng) * 111000 * cos;
  const py = (p.lat - a.lat) * 111000;
  const dx = (b.lng - a.lng) * 111000 * cos;
  const dy = (b.lat - a.lat) * 111000;
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
  if (maxD > epsilon) {
    const L = rdp(points.slice(0, maxI + 1), epsilon);
    const R = rdp(points.slice(maxI), epsilon);
    return L.slice(0, -1).concat(R);
  }
  return [points[0], points[last]];
}

function computeStats(points) {
  let distM = 0, gain = 0, loss = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dlat = (b.lat - a.lat) * 111000;
    const dlng = (b.lng - a.lng) * 111000 * Math.cos(b.lat * Math.PI / 180);
    distM += Math.hypot(dlat, dlng);
    const dAlt = b.alt - a.alt;
    if (dAlt > 0) gain += dAlt; else loss += -dAlt;
  }
  return {
    distance_km:    Math.round(distM / 100) / 10,
    elevation_gain: Math.round(gain),
    elevation_loss: Math.round(loss),
  };
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildGpxHeader(name) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="https://trailradar.org" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <author>
      <link href="https://trailradar.org">
        <text>Trailradar</text>
        <type>text/html</type>
      </link>
    </author>
  </metadata>
`;
}

function buildGpxXml(points, name) {
  const trkpts = points.map(p => {
    const time = p.time ? `\n        <time>${p.time.toISOString()}</time>` : '';
    return `      <trkpt lat="${p.lat}" lon="${p.lng}"><ele>${p.alt}</ele>${time}</trkpt>`;
  }).join('\n');
  return `${buildGpxHeader(name)}  <trk>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

// ── Storage ──────────────────────────────────────────────────────────────────

async function fetchGpxContent(gpxUrl) {
  const res = await fetch(gpxUrl);
  if (!res.ok) throw new Error(`Fetching gpx_url failed (${res.status}): ${gpxUrl}`);
  return res.text();
}

function storagePathFromUrl(gpxUrl) {
  const marker = '/gpx-files/';
  const idx = gpxUrl.indexOf(marker);
  if (idx === -1) throw new Error(`Unrecognised gpx_url shape: ${gpxUrl}`);
  return gpxUrl.slice(idx + marker.length);
}

async function uploadGpx(path, content) {
  const store = `${SUPABASE_URL}/storage/v1`;
  const gpxHeaders = { ...restHeaders(), 'Content-Type': 'application/gpx+xml' };
  let res = await fetch(`${store}/object/gpx-files/${path}`, { method: 'PUT', headers: gpxHeaders, body: content });
  if (!res.ok) throw new Error(`GPX upload failed (${res.status}): ${await res.text()}`);
}

// ── DB ───────────────────────────────────────────────────────────────────────

async function fetchRows(table) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=id,spot_id,name,gpx_url,elevation_gain,elevation_loss&spot_id=in.(${SPOT_IDS.join(',')})`;
  const res = await fetch(url, { headers: restHeaders() });
  if (!res.ok) throw new Error(`Fetch ${table} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function updateRow(table, id, gpx_points, stats) {
  if (DRY_RUN) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...restHeaders(), 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ gpx_points, ...stats }),
  });
  if (!res.ok) throw new Error(`Update failed (${res.status}): ${await res.text()}`);
}

// ── Process one row ──────────────────────────────────────────────────────────

async function processRow(table, row, counts) {
  const label = `${table} id=${row.id} spot_id=${row.spot_id} ("${row.name}")`;
  if (!row.gpx_url) { console.log(`  ·  ${label} — no gpx_url, skipping`); counts.skipped++; return; }

  try {
    const content = await fetchGpxContent(row.gpx_url);
    const { name, points } = parseGpx(content);
    if (points.length === 0) { console.log(`  ·  ${label} — no trkpts parsed, skipping`); counts.skipped++; return; }

    const thinned = rdp(points, EPSILON_M);
    const elevations = await fetchDemElevations(thinned.map(p => [p.lat, p.lng]));
    const corrected = thinned.map((p, i) => ({ ...p, alt: Math.round(elevations[i]) }));
    const stats = computeStats(corrected);
    const gpx_points = corrected.map(p => [
      Math.round(p.lat * 1e6) / 1e6,
      Math.round(p.lng * 1e6) / 1e6,
      p.alt,
    ]);
    const newGpxContent = buildGpxXml(corrected, name || row.name);
    const path = storagePathFromUrl(row.gpx_url);

    console.log(
      `  ${DRY_RUN ? '→' : '✓'}  ${label} — ${points.length} raw → ${thinned.length} thinned pts, ` +
      `gain ${row.elevation_gain}→${stats.elevation_gain}m, loss ${row.elevation_loss}→${stats.elevation_loss}m, ` +
      `path=${path}` + (DRY_RUN ? ' (dry-run, not written)' : '')
    );

    await uploadGpx(path, newGpxContent);
    await updateRow(table, row.id, gpx_points, stats);
    counts.updated++;
  } catch (err) {
    console.error(`  ✗  ${label} — ${err.message}`);
    counts.failed++;
  }
}

async function main() {
  if (DRY_RUN) {
    console.log(`🧪 DRY_RUN=1 — no writes will be made. Dataset: ${DATASET}\n`);
  } else {
    console.log('⚠️  Live run — this will overwrite the .gpx file in Storage AND');
    console.log('    gpx_points/elevation_gain/elevation_loss in the DB for the rows below.');
    console.log('    Make sure you already ran `npm run backup` and reviewed a DRY_RUN=1 pass.\n');
  }
  console.log(`Spots: ${SPOT_IDS.join(', ')}\n`);

  const counts = { updated: 0, skipped: 0, failed: 0 };
  for (const table of TABLES) {
    const rows = await fetchRows(table);
    console.log(`📍 ${table}: ${rows.length} row(s)`);
    for (const row of rows) await processRow(table, row, counts);
  }

  console.log('\n── Summary ──────────────────────────────');
  console.log(`  Updated: ${counts.updated}${DRY_RUN ? ' (dry-run, not written)' : ''}`);
  console.log(`  Skipped: ${counts.skipped}`);
  console.log(`  Failed:  ${counts.failed}`);
  console.log('✅ Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
