#!/usr/bin/env node
/**
 * rewrite-gpx-headers.js
 *
 * ⚠️  DANGER — overwrites Supabase Storage objects IN PLACE.
 * Storage has no built-in versioning/undo for these files — once a GPX
 * object is overwritten here, the previous content is gone unless you
 * took a backup first.
 *
 *   1. Run `npm run backup` (scripts/backup.js, covers Storage) BEFORE
 *      running this for real.
 *   2. Always do a `DRY_RUN=1` pass first and review the diff/log output.
 *
 * One-off backfill: rewrites the GPX preamble (everything before the
 * first <trk>) of every row in spot_gpx_trails / spot_gpx_tours to the
 * canonical TrailRadar header (see scripts/gpx-header.js), replacing
 * whatever header/metadata the original file had (Komoot, Strava, ...).
 * The <trk> body — including any inner <trk><name>text</trk> — is left
 * untouched. Idempotent: rows already carrying the TrailRadar header are
 * skipped, so this is safe to interrupt and re-run.
 *
 * Requires env vars:
 *   SUPABASE_URL          e.g. https://ixafegmxkadbzhxmepsd.supabase.co
 *   SUPABASE_SERVICE_KEY  service_role key (bypasses RLS)
 *
 * Usage:
 *   node --env-file=.env rewrite-gpx-headers.js
 *
 * Dry-run (download + diff-check only, no storage writes):
 *   DRY_RUN=1 node rewrite-gpx-headers.js
 */

const { rewriteGpxHeader } = require('./gpx-header');

const DRY_RUN = process.env.DRY_RUN === '1';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL) { console.error('Missing env: SUPABASE_URL'); process.exit(1); }
if (!SERVICE_KEY)  { console.error('Missing env: SUPABASE_SERVICE_KEY'); process.exit(1); }

const TRAILRADAR_MARKER = 'creator="https://trailradar.org"';
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/gpx-files/`;

const TABLES = ['spot_gpx_trails', 'spot_gpx_tours'];
const PAGE_SIZE = 500;

function restHeaders() {
  return {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  };
}

// ── Paginated REST fetch ──────────────────────────────────────────────────────
// Row count could exceed the default page size, so page through with Range.

async function fetchAllRows(table) {
  const rows = [];
  let offset = 0;

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=id,spot_id,name,filename,gpx_url&order=id`;
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

// ── Storage helpers ────────────────────────────────────────────────────────────

async function downloadGpx(gpx_url) {
  const res = await fetch(gpx_url, { headers: restHeaders() }); // public bucket, headers defensive
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${gpx_url}`);
  }
  return res.text();
}

function storagePathFromUrl(gpx_url) {
  if (!gpx_url.startsWith(PUBLIC_PREFIX)) return null;
  return gpx_url.slice(PUBLIC_PREFIX.length);
}

async function putGpx(storagePath, content) {
  if (DRY_RUN) return; // no network writes in dry-run

  const url = `${SUPABASE_URL}/storage/v1/object/gpx-files/${storagePath}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/gpx+xml',
    },
    body: content,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Storage overwrite failed (${res.status}): ${body}`);
  }
}

// ── Process one table ──────────────────────────────────────────────────────────

async function processTable(table, counts) {
  const rows = await fetchAllRows(table);
  console.log(`\n📍 ${table}: ${rows.length} row(s)`);

  for (const row of rows) {
    const label = `${table} id=${row.id} ("${row.name ?? row.filename}")`;

    let content;
    try {
      content = await downloadGpx(row.gpx_url);
    } catch (err) {
      console.error(`  ✗  ${label} — download failed: ${err.message}`);
      counts.failed++;
      continue;
    }

    if (content.includes(TRAILRADAR_MARKER)) {
      console.log(`  ·  ${label} — already migrated, skipping`);
      counts.alreadyMigrated++;
      continue;
    }

    const rewritten = rewriteGpxHeader(content, row.name);

    if (rewritten === content) {
      console.warn(`  ⚠  ${label} — no <trk> found, skipping to avoid corrupting the file`);
      counts.skippedWarning++;
      continue;
    }

    const storagePath = storagePathFromUrl(row.gpx_url);
    if (!storagePath) {
      console.warn(`  ⚠  ${label} — gpx_url doesn't match expected public prefix, skipping: ${row.gpx_url}`);
      counts.skippedWarning++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  → ${label} — would rewrite header → ${storagePath}`);
    } else {
      try {
        await putGpx(storagePath, rewritten);
        console.log(`  ✓  ${label} — rewritten → ${storagePath}`);
      } catch (err) {
        console.error(`  ✗  ${label} — upload failed: ${err.message}`);
        counts.failed++;
        continue;
      }
    }

    counts.rewritten++;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) {
    console.log('🧪 DRY_RUN=1 — no storage writes will be made.\n');
  } else {
    console.log('⚠️  Live run — this will overwrite GPX files in Supabase Storage in place.');
    console.log('    Make sure you already ran `npm run backup` and reviewed a DRY_RUN=1 pass.\n');
  }

  const counts = { rewritten: 0, alreadyMigrated: 0, skippedWarning: 0, failed: 0 };

  for (const table of TABLES) {
    await processTable(table, counts);
  }

  console.log('\n── Summary ──────────────────────────────');
  console.log(`  Rewritten:        ${counts.rewritten}${DRY_RUN ? ' (dry-run, not written)' : ''}`);
  console.log(`  Already migrated: ${counts.alreadyMigrated}`);
  console.log(`  Skipped (warn):   ${counts.skippedWarning}`);
  console.log(`  Failed:           ${counts.failed}`);
  console.log('✅ Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
