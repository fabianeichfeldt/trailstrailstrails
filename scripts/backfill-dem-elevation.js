#!/usr/bin/env node
/**
 * backfill-dem-elevation.js
 *
 * ⚠️  DANGER — overwrites `gpx_points` (and elevation_gain/elevation_loss)
 * in spot_gpx_trails AND spot_gpx_tours IN PLACE. Run `npm run backup` first
 * and review a DRY_RUN=1 pass before running for real.
 *
 * One-off backfill: replaces the altitude of every point in every
 * spot_gpx_trails / spot_gpx_tours row with a DEM-derived elevation from Open Topo Data
 * (dataset "eudem25m" — EU-DEM, 25m resolution, Europe-only). Recorded GPX
 * altitude (barometric/GPS, often noisy — e.g. Komoot exports) is discarded
 * entirely and replaced. lat/lng are never modified, so distance_km is
 * unaffected; elevation_gain/elevation_loss are recomputed from the new
 * altitudes since they depend on it.
 *
 * Open Topo Data public API limits: 100 locations/request, ~1 request/sec,
 * 1000 requests/day. This script chunks each row's points into batches of
 * 100 and throttles globally to 1 request/sec across the whole run.
 *
 * Requires env vars:
 *   SUPABASE_URL          e.g. https://ixafegmxkadbzhxmepsd.supabase.co
 *   SUPABASE_SERVICE_KEY  service_role key (bypasses RLS)
 *
 * Optional env vars:
 *   SPOT_ID    only process rows for this spot_id (test on one spot first)
 *   DATASET    Open Topo Data dataset (default: eudem25m)
 *
 * Usage:
 *   node --env-file=.env backfill-dem-elevation.js
 *
 * Dry-run (fetch elevation + compute diff only, no DB writes):
 *   DRY_RUN=1 node --env-file=.env backfill-dem-elevation.js
 *
 * Test on a single spot first:
 *   SPOT_ID=some-spot-id DRY_RUN=1 node --env-file=.env backfill-dem-elevation.js
 */

const DRY_RUN = process.env.DRY_RUN === '1';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const SPOT_ID       = process.env.SPOT_ID || null;
const DATASET       = process.env.DATASET || 'eudem25m';

if (!SUPABASE_URL) { console.error('Missing env: SUPABASE_URL'); process.exit(1); }
if (!SERVICE_KEY)  { console.error('Missing env: SUPABASE_SERVICE_KEY'); process.exit(1); }

const TABLES = ['spot_gpx_trails', 'spot_gpx_tours'];
const PAGE_SIZE = 500;
const CHUNK_SIZE = 100;       // Open Topo Data max locations/request
const MIN_REQUEST_GAP_MS = 1100; // stay under ~1 req/sec

function restHeaders() {
  return {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Paginated REST fetch ────────────────────────────────────────────────────

async function fetchAllRows(table) {
  const rows = [];
  let offset = 0;

  while (true) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=id,spot_id,name,gpx_points&order=id`;
    if (SPOT_ID) url += `&spot_id=eq.${encodeURIComponent(SPOT_ID)}`;

    const res = await fetch(url, {
      headers: {
        ...restHeaders(),
        'Range-Unit': 'items',
        'Range': `${offset}-${offset + PAGE_SIZE - 1}`,
      },
    });

    if (!res.ok && res.status !== 206) {
      const body = await res.text();
      throw new Error(`Fetch ${table} failed (${res.status}): ${body}`);
    }

    const page = await res.json();
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows;
}

// ── Open Topo Data, globally rate-limited ───────────────────────────────────

let lastRequestAt = 0;

async function fetchElevations(latLngs) {
  const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const locations = latLngs.map(([lat, lng]) => `${lat},${lng}`).join('|');
  const url = `https://api.opentopodata.org/v1/${DATASET}?locations=${locations}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open Topo Data request failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  if (data.status !== 'OK') {
    throw new Error(`Open Topo Data error: ${JSON.stringify(data)}`);
  }
  return data.results.map(r => r.elevation);
}

async function correctedPoints(gpxPoints) {
  const corrected = [];
  for (let i = 0; i < gpxPoints.length; i += CHUNK_SIZE) {
    const chunk = gpxPoints.slice(i, i + CHUNK_SIZE);
    const elevations = await fetchElevations(chunk.map(p => [p[0], p[1]]));
    chunk.forEach(([lat, lng], j) => {
      corrected.push([lat, lng, Math.round(elevations[j])]);
    });
  }
  return corrected;
}

function computeGainLoss(points) {
  let gain = 0, loss = 0;
  for (let i = 1; i < points.length; i++) {
    const d = points[i][2] - points[i - 1][2];
    if (d > 0) gain += d; else loss += -d;
  }
  return { elevation_gain: Math.round(gain), elevation_loss: Math.round(loss) };
}

// ── Write back ───────────────────────────────────────────────────────────────

async function updateRow(table, id, gpx_points, stats) {
  if (DRY_RUN) return;

  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...restHeaders(),
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ gpx_points, ...stats }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Update failed (${res.status}): ${body}`);
  }
}

// ── Process one table ────────────────────────────────────────────────────────

async function processTable(table, counts) {
  const rows = await fetchAllRows(table);
  console.log(`\n📍 ${table}: ${rows.length} row(s)`);

  for (const row of rows) {
    const label = `${table} id=${row.id} spot_id=${row.spot_id} ("${row.name}")`;

    if (!Array.isArray(row.gpx_points) || row.gpx_points.length === 0) {
      console.log(`  ·  ${label} — no gpx_points, skipping`);
      counts.skipped++;
      continue;
    }

    try {
      const corrected = await correctedPoints(row.gpx_points);
      const stats = computeGainLoss(corrected);

      const before = computeGainLoss(row.gpx_points);
      console.log(
        `  ${DRY_RUN ? '→' : '✓'}  ${label} — ${row.gpx_points.length} pts, ` +
        `gain ${before.elevation_gain}→${stats.elevation_gain}m, loss ${before.elevation_loss}→${stats.elevation_loss}m` +
        (DRY_RUN ? ' (dry-run, not written)' : '')
      );

      await updateRow(table, row.id, corrected, stats);
      counts.updated++;
    } catch (err) {
      console.error(`  ✗  ${label} — ${err.message}`);
      counts.failed++;
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) {
    console.log(`🧪 DRY_RUN=1 — no DB writes will be made. Dataset: ${DATASET}\n`);
  } else {
    console.log('⚠️  Live run — this will overwrite gpx_points/elevation_gain/elevation_loss');
    console.log(`    in ${TABLES.join(' and ')}.`);
    console.log('    Make sure you already ran `npm run backup` and reviewed a DRY_RUN=1 pass.\n');
  }
  if (SPOT_ID) console.log(`Filtering to spot_id=${SPOT_ID}\n`);

  const counts = { updated: 0, skipped: 0, failed: 0 };

  for (const table of TABLES) {
    await processTable(table, counts);
  }

  console.log('\n── Summary ──────────────────────────────');
  console.log(`  Updated: ${counts.updated}${DRY_RUN ? ' (dry-run, not written)' : ''}`);
  console.log(`  Skipped: ${counts.skipped}`);
  console.log(`  Failed:  ${counts.failed}`);
  console.log('✅ Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
