#!/usr/bin/env node
/**
 * push-gpx.js
 *
 * Reads data/processed.json (output of preprocess-gpx.js) and upserts
 * the records into Supabase tables:
 *   spot_gpx_trails
 *   spot_gpx_tours
 *
 * Requires env vars:
 *   SUPABASE_URL          e.g. https://ixafegmxkadbzhxmepsd.supabase.co
 *   SUPABASE_SERVICE_KEY  service_role key (bypasses RLS)
 *
 * Usage:
 *   node push-gpx.js [processedFile]
 *   processedFile defaults to ./data/processed.json
 *
 * Dry-run (print payloads, no network calls):
 *   DRY_RUN=1 node push-gpx.js
 */

const fs   = require('fs');
const path = require('path');

const PROCESSED_FILE = process.argv[2] || path.join(__dirname, 'data', 'processed.json');
const DRY_RUN = process.env.DRY_RUN === '1';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!DRY_RUN) {
  if (!SUPABASE_URL) { console.error('Missing env: SUPABASE_URL'); process.exit(1); }
  if (!SERVICE_KEY)  { console.error('Missing env: SUPABASE_SERVICE_KEY'); process.exit(1); }
}

// ── Filename sanitization ────────────────────────────────────────────────────
// Supabase Storage doesn't accept spaces or most special characters.

function sanitizeStorageFilename(filename) {
  return filename
    .replace(/\s+/g, '_')           // spaces → underscores
    .replace(/[^a-zA-Z0-9._-]/g, ''); // keep only alphanumeric, dot, dash, underscore
}

// ── Supabase Storage helpers ──────────────────────────────────────────────────

async function uploadToStorage(bucketName, filePath, content) {
  if (DRY_RUN) return filePath; // Return the path that would be used

  const url = `${SUPABASE_URL}/storage/v1/object/${bucketName}/${filePath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/gpx+xml',
    },
    body: content,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Storage upload failed (${res.status}): ${body}`);
  }

  // Return public URL
  return `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`;
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────

async function upsert(table, rows) {
  if (rows.length === 0) return;

  if (DRY_RUN) {
    console.log(`  [dry-run] Would upsert ${rows.length} row(s) into ${table}`);
    console.log('  Sample:', JSON.stringify(rows[0], (k, v) =>
      k === 'gpx_points' ? `[${v.length} points]` :
      k === 'gpx_url' ? '<url>' : v, 2).slice(0, 300));
    return;
  }

  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table} upsert failed (${res.status}): ${body}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(PROCESSED_FILE)) {
    console.error(`processed.json not found: ${PROCESSED_FILE}`);
    console.error('Run preprocess-gpx.js first.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf8'));
  const spotIds = Object.keys(data);

  if (spotIds.length === 0) {
    console.log('Nothing to push.');
    return;
  }

  // Note: spotIds include optional names, e.g., "uuid" or "uuid_name"
  for (const spotId of spotIds) {
    const { trails = [], tours = [] } = data[spotId];

    console.log(`\n📍 Spot: ${spotId}  (${trails.length} trails, ${tours.length} tours)`);

    // ── Trails ──
    for (const t of trails) {
      if (!t.difficulty) {
        console.warn(`  ⚠  Trail "${t.name}" has no difficulty set — skipping`);
        continue;
      }
      if (!t.direction) {
        console.warn(`  ⚠  Trail "${t.name}" has no direction set — skipping`);
        continue;
      }

      // Upload GPX file to storage
      const sanitizedFilename = sanitizeStorageFilename(t.filename);
      const storagePath = `trails/${spotId}/${sanitizedFilename}`;
      const gpx_url = await uploadToStorage('gpx-files', storagePath, t.gpx_content);

      if (DRY_RUN) {
        console.log(`  → trail  "${t.name}" → ${storagePath}`);
      } else {
        console.log(`  → trail  "${t.name}" (${t.thinned_points ?? '?'} pts, ${t.distance_km} km) → storage`);
      }

      const row = {
        spot_id:          spotId,
        name:             t.name,
        filename:         t.filename,
        difficulty:       t.difficulty,
        direction:        t.direction,
        distance_km:      t.distance_km,
        elevation_gain:   t.elevation_gain,
        elevation_loss:   t.elevation_loss,
        duration_minutes: t.duration_minutes,
        gpx_points:       t.gpx_points,
        gpx_url,
      };

      await upsert('spot_gpx_trails', [row]);
    }

    // ── Tours ──
    for (const t of tours) {
      if (!t.direction) {
        console.warn(`  ⚠  Tour "${t.name}" has no direction set — skipping`);
        continue;
      }

      // Upload GPX file to storage
      const sanitizedFilename = sanitizeStorageFilename(t.filename);
      const storagePath = `tours/${spotId}/${sanitizedFilename}`;
      const gpx_url = await uploadToStorage('gpx-files', storagePath, t.gpx_content);

      if (DRY_RUN) {
        console.log(`  → tour   "${t.name}" → ${storagePath}`);
      } else {
        console.log(`  → tour   "${t.name}" (${t.gpx_points?.length ?? '?'} pts, ${t.distance_km} km) → storage`);
      }

      const row = {
        spot_id:          spotId,
        name:             t.name,
        filename:         t.filename,
        direction:        t.direction,
        trail_names:      t.trail_names ?? [],
        distance_km:      t.distance_km,
        elevation_gain:   t.elevation_gain,
        elevation_loss:   t.elevation_loss,
        duration_minutes: t.duration_minutes,
        gpx_points:       t.gpx_points,
        gpx_url,
      };

      await upsert('spot_gpx_tours', [row]);
    }
  }

  console.log('\n✅ Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
