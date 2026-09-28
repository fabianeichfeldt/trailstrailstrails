#!/usr/bin/env node
/**
 * One-off restore: puts the pre-incident original raw content of
 * D'Oachkätzla Line (8028) back to its exact Storage path. See project
 * history — an earlier "dry run" of fix-broken-elevation-gpx.js had a bug
 * (uploadGpx() ignored DRY_RUN) and overwrote this file with an RDP-thinned
 * version (350 raw points -> 70) before that guard was fixed.
 *
 * The content restored here was downloaded straight from the live gpx_url
 * BEFORE any script touched it, so it is the true original: 350 raw points,
 * ele=0 for all of them (the actual bug being fixed).
 *
 * Required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
 * Usage: node --env-file=.env restore-doachkatzla-original.js <path-to-backup.gpx>
 */

import { readFileSync } from 'node:fs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const BACKUP_PATH  = process.argv[2];

if (!SUPABASE_URL) { console.error('Missing env: SUPABASE_URL'); process.exit(1); }
if (!SERVICE_KEY)  { console.error('Missing env: SUPABASE_SERVICE_KEY'); process.exit(1); }
if (!BACKUP_PATH)  { console.error('Usage: node restore-doachkatzla-original.js <path-to-backup.gpx>'); process.exit(1); }

const STORAGE_PATH = 'c9dfd4e3-c958-4c46-8c9e-726a84535c2d/trails/DOachktzla_Line_8028.gpx';

async function main() {
  const content = readFileSync(BACKUP_PATH, 'utf8');
  const trkptCount = (content.match(/<trkpt\b/g) || []).length;
  console.log(`Restoring ${BACKUP_PATH} (${trkptCount} trkpts) to ${STORAGE_PATH}`);

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/gpx-files/${STORAGE_PATH}`, {
    method: 'PUT',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/gpx+xml',
    },
    body: content,
  });
  if (!res.ok) throw new Error(`Restore failed (${res.status}): ${await res.text()}`);
  console.log('✅ Restored.');
}

main().catch(err => { console.error(err); process.exit(1); });
