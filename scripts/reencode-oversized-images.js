#!/usr/bin/env node
/**
 * reencode-oversized-images.js
 *
 * ⚠️  Overwrites objects in the `trail-photos` and `avatars` buckets IN PLACE.
 * Review a DRY_RUN=1 pass first. Every original is saved to BACKUP_DIR before
 * it is overwritten, so a run can be undone by re-uploading those files.
 *
 * One-off cleanup: before the upload fix, iOS Safari uploads were stored as
 * multi-MB PNGs under a `.webp` name (canvas.toBlob ignores 'image/webp' there),
 * and avatars were stored unresized. This re-encodes every object above
 * MIN_BYTES into a real WebP at the same path, so the URLs in `trail_photos` /
 * profiles stay valid.
 *
 * Requires env vars:
 *   SUPABASE_URL          e.g. https://ixafegmxkadbzhxmepsd.supabase.co
 *   SUPABASE_SERVICE_KEY  service_role key (bypasses RLS)
 *
 * Optional env vars:
 *   MIN_BYTES   only objects larger than this (default: 400000)
 *   BACKUP_DIR  where originals are saved (default: ./image-backups/<timestamp>)
 *   BUCKET      only this bucket (trail-photos | avatars)
 *
 * Usage:
 *   DRY_RUN=1 node --env-file=.env reencode-oversized-images.js
 *   node --env-file=.env reencode-oversized-images.js
 */

const fs = require('node:fs');
const path = require('node:path');
// Resolved from the root package's node_modules (transitive dep of @capacitor/assets).
const sharp = require('sharp');

const DRY_RUN = process.env.DRY_RUN === '1';
const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const MIN_BYTES = Number(process.env.MIN_BYTES ?? 400_000);
const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(__dirname, 'image-backups', new Date().toISOString().replace(/[:.]/g, '-'));

// Same limits as the client-side upload (app/communication/photos.ts).
const BUCKETS = {
  'trail-photos': { maxWidth: 1000, cacheControl: '31536000' },
  'avatars':      { maxWidth: 256,  cacheControl: '3600' },
};

if (!SUPABASE_URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function listObjects(bucket, prefix = '') {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!res.ok) throw new Error(`list ${bucket}/${prefix} failed: ${res.status} ${await res.text()}`);
  const out = [];
  for (const entry of await res.json()) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Folders come back without an id.
    if (entry.id === null) out.push(...await listObjects(bucket, full));
    else out.push({ name: full, size: entry.metadata?.size ?? 0 });
  }
  return out;
}

async function processObject(bucket, obj, { maxWidth, cacheControl }) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${obj.name}`, { headers });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const original = Buffer.from(await res.arrayBuffer());

  const reencoded = await sharp(original)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const kb = n => `${Math.round(n / 1024)} kB`;
  if (reencoded.length >= original.length) {
    console.log(`  skip  ${bucket}/${obj.name}  ${kb(original.length)} (re-encode not smaller)`);
    return 0;
  }
  console.log(`  ${DRY_RUN ? 'would' : 'write'} ${bucket}/${obj.name}  ${kb(original.length)} → ${kb(reencoded.length)}`);
  if (DRY_RUN) return original.length - reencoded.length;

  const backupPath = path.join(BACKUP_DIR, bucket, obj.name);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, original);

  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${obj.name}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'image/webp', 'cache-control': `max-age=${cacheControl}`, 'x-upsert': 'true' },
    body: reencoded,
  });
  if (!up.ok) throw new Error(`upload failed: ${up.status} ${await up.text()}`);
  return original.length - reencoded.length;
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — nothing is written' : `Backing up originals to ${BACKUP_DIR}`);
  let saved = 0;
  let failed = 0;
  for (const [bucket, opts] of Object.entries(BUCKETS)) {
    if (process.env.BUCKET && process.env.BUCKET !== bucket) continue;
    const big = (await listObjects(bucket)).filter(o => o.size > MIN_BYTES);
    console.log(`\n${bucket}: ${big.length} objects over ${MIN_BYTES} bytes`);
    for (const obj of big) {
      try {
        saved += await processObject(bucket, obj, opts);
      } catch (e) {
        failed++;
        console.error(`  FAIL  ${bucket}/${obj.name}: ${e.message}`);
      }
    }
  }
  console.log(`\n${DRY_RUN ? 'Would save' : 'Saved'} ${Math.round(saved / 1024 / 1024)} MB per full download of these files; ${failed} failed.`);
  if (failed) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
