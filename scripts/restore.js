/**
 * Supabase full restore script
 *
 * Restores a backup created by backup.js into the target Supabase project.
 * Sections restored: database (psql), edge functions, storage, auth users.
 *
 * External tools required (besides Node ≥ 18):
 *   psql   — part of libpq/postgresql-client, used to replay the DB dump
 *            macOS:  brew install libpq && brew link --force libpq
 *            Linux:  apt install postgresql-client
 *            Only needed when database/full.sql is present in the backup.
 *
 * ⚠️  Auth caveat: passwords cannot be restored (they are hashed and never
 *    exported). Restored users will have no password and must use "forgot
 *    password" / magic link to sign in. All other user metadata is preserved.
 *
 * ⚠️  Database caveat: the restore runs full.sql against the target DB which
 *    may conflict with existing data. Restore to a fresh project or drop
 *    conflicting tables first.
 *
 * Required env vars:
 *   SUPABASE_URL              — https://<ref>.supabase.co  (target project)
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (also accepts SUPABASE_SERVICE_KEY)
 *   SUPABASE_DB_PASSWORD      — postgres password for psql
 *   SUPABASE_ACCESS_TOKEN     — personal access token for Management API (functions)
 *
 * Usage:  node --env-file=.env restore.js <backup-dir>
 *         node --env-file=.env restore.js backups/2026-05-10T08-00-00
 *         node --env-file=.env restore.js backups/2026-05-10T08-00-00 --skip-db
 *         node --env-file=.env restore.js backups/2026-05-10T08-00-00 --only=storage,auth
 */

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

// ── config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const DB_PASSWORD      = process.env.SUPABASE_DB_PASSWORD;
const ACCESS_TOKEN     = process.env.SUPABASE_ACCESS_TOKEN;

const args       = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags      = process.argv.slice(2).filter(a => a.startsWith('--'));
const backupDir  = args[0];

const onlyFlag   = flags.find(f => f.startsWith('--only='));
const only       = onlyFlag ? new Set(onlyFlag.replace('--only=', '').split(',')) : null;
const skipDb     = flags.includes('--skip-db');

function shouldRun(section) {
  if (only) return only.has(section);
  if (section === 'database' && skipDb) return false;
  return true;
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

if (!backupDir) {
  console.error('❌  Usage: node restore.js <backup-dir>');
  process.exit(1);
}

if (!existsSync(backupDir)) {
  console.error(`❌  Backup directory not found: ${backupDir}`);
  process.exit(1);
}

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

// read manifest if present
const manifestPath = join(backupDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

console.log(`\n♻️   Restore from ${backupDir}`);
if (manifest.created_at) console.log(`    Backup created: ${manifest.created_at}`);
if (manifest.project_ref && manifest.project_ref !== PROJECT_REF) {
  console.warn(`    ⚠️  Backup is from project ${manifest.project_ref}, restoring into ${PROJECT_REF}`);
}
console.log();

// ── helpers ───────────────────────────────────────────────────────────────────

async function post(url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  return res;
}

async function patch(url, body, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  return res;
}

async function getJSON(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      ...extraHeaders,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}  (${url})`);
  return res.json();
}

// ── 1. database ───────────────────────────────────────────────────────────────

async function restoreDatabase() {
  console.log('🗄️   Database …');

  const fullSql = join(backupDir, 'database', 'full.sql');
  if (!existsSync(fullSql)) {
    console.warn('    ⚠️  database/full.sql not found — skipping');
    return;
  }

  if (!DB_PASSWORD) {
    console.warn('    ⚠️  SUPABASE_DB_PASSWORD not set — skipping DB restore');
    return;
  }

  const psqlAvailable = spawnSync('which', ['psql']).status === 0;
  if (!psqlAvailable) {
    console.warn('    ⚠️  psql not found — skipping DB restore');
    console.warn('       Install: brew install libpq && brew link --force libpq');
    return;
  }

  const host    = `db.${PROJECT_REF}.supabase.co`;
  const connStr = `postgresql://postgres:${DB_PASSWORD}@${host}:5432/postgres`;

  try {
    execSync(`psql "${connStr}" -f "${fullSql}"`, {
      env:       { ...process.env, PGPASSWORD: DB_PASSWORD },
      maxBuffer: 200 * 1024 * 1024,
      stdio:     ['pipe', 'pipe', 'pipe'],
    });
    console.log('    ✅  full.sql applied');
  } catch (err) {
    // psql exits non-zero even for non-fatal notices; print stderr for diagnosis
    const stderr = err.stderr?.toString() ?? err.message;
    const fatal  = stderr.split('\n').filter(l => l.toLowerCase().includes('error'));
    if (fatal.length > 0) {
      console.error('    ❌  psql errors:');
      fatal.slice(0, 10).forEach(l => console.error('       ', l));
    } else {
      console.log('    ✅  full.sql applied (with warnings)');
    }
  }
}

// ── 2. edge functions ─────────────────────────────────────────────────────────

async function restoreFunctions() {
  console.log('⚡️   Edge functions …');

  const functionsDir = join(backupDir, 'functions');
  if (!existsSync(functionsDir)) {
    console.warn('    ⚠️  functions/ not found — skipping');
    return;
  }

  if (!ACCESS_TOKEN) {
    console.warn('    ⚠️  SUPABASE_ACCESS_TOKEN not set — skipping functions');
    return;
  }

  const mgmtHeaders = { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' };
  const base        = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`;

  // fetch existing functions to know whether to POST or PATCH
  let existing = [];
  try {
    const res = await fetch(base, { headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` } });
    if (res.ok) existing = await res.json();
  } catch {}
  const existingSlugs = new Set((existing ?? []).map(f => f.slug));

  const slugDirs = readdirSync(functionsDir).filter(
    name => name !== '_index.json' && statSync(join(functionsDir, name)).isDirectory()
  );

  if (slugDirs.length === 0) {
    console.log('    ℹ️   no functions in backup');
    return;
  }

  for (const slug of slugDirs) {
    const dir      = join(functionsDir, slug);
    const codePath = join(dir, 'index.ts');
    const metaPath = join(dir, 'meta.json');

    if (!existsSync(codePath)) {
      console.warn(`    ⚠️  ${slug}: index.ts missing, skipping`);
      continue;
    }

    const code = readFileSync(codePath, 'utf8');
    const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};

    const payload = {
      slug,
      name:       meta.name ?? slug,
      body:       code,
      verify_jwt: meta.verify_jwt ?? true,
    };

    try {
      let res;
      if (existingSlugs.has(slug)) {
        // update existing
        res = await fetch(`${base}/${slug}`, {
          method: 'PATCH',
          headers: mgmtHeaders,
          body: JSON.stringify({ name: payload.name, body: code, verify_jwt: payload.verify_jwt }),
        });
      } else {
        // create new
        res = await fetch(base, {
          method: 'POST',
          headers: mgmtHeaders,
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        console.log(`    ✅  ${slug} (${existingSlugs.has(slug) ? 'updated' : 'created'})`);
      } else {
        const err = await res.text();
        console.error(`    ❌  ${slug}: ${res.status} ${err}`);
      }
    } catch (err) {
      console.error(`    ❌  ${slug}: ${err.message}`);
    }
  }
}

// ── 3. storage ────────────────────────────────────────────────────────────────

async function restoreStorage() {
  console.log('🪣   Storage …');

  const storageDir  = join(backupDir, 'storage');
  const bucketsFile = join(storageDir, '_buckets.json');

  if (!existsSync(bucketsFile)) {
    console.warn('    ⚠️  storage/_buckets.json not found — skipping');
    return;
  }

  const buckets = JSON.parse(readFileSync(bucketsFile, 'utf8'));

  // fetch existing buckets
  let existingBuckets = [];
  try {
    existingBuckets = await getJSON(`${SUPABASE_URL}/storage/v1/bucket`);
  } catch {}
  const existingIds = new Set((existingBuckets ?? []).map(b => b.id));

  for (const bucket of buckets) {
    const bucketId  = bucket.id;
    const bucketDir = join(storageDir, bucketId);

    // create bucket if missing
    if (!existingIds.has(bucketId)) {
      const res = await post(`${SUPABASE_URL}/storage/v1/bucket`, {
        id:     bucketId,
        name:   bucket.name,
        public: bucket.public ?? false,
        file_size_limit:        bucket.file_size_limit ?? null,
        allowed_mime_types:     bucket.allowed_mime_types ?? null,
      });
      if (!res.ok) {
        console.error(`    ❌  could not create bucket ${bucketId}: ${res.status}`);
        continue;
      }
      console.log(`    🪣  created bucket: ${bucketId}`);
    }

    if (!existsSync(bucketDir)) {
      console.warn(`    ⚠️  ${bucketId}: no local files in backup, skipping upload`);
      continue;
    }

    // collect all files under the bucket dir
    const files = walkDir(bucketDir).filter(f => !f.endsWith('_objects.json'));
    console.log(`    bucket: ${bucketId} (${files.length} files)`);

    for (const absPath of files) {
      const relPath = absPath.slice(bucketDir.length + 1).replace(/\\/g, '/');
      try {
        const fileData = readFileSync(absPath);
        const mimeType = guessMime(relPath);

        const res = await fetch(
          `${SUPABASE_URL}/storage/v1/object/${bucketId}/${relPath}`,
          {
            method: 'POST',
            headers: {
              'Authorization':  `Bearer ${SERVICE_ROLE_KEY}`,
              'Content-Type':   mimeType,
              'x-upsert':       'true',
            },
            body: fileData,
          }
        );

        if (!res.ok) {
          const body = await res.text();
          console.error(`      ❌  ${relPath}: ${res.status} ${body}`);
        }
      } catch (err) {
        console.error(`      ❌  ${relPath}: ${err.message}`);
      }
    }
    console.log(`    ✅  ${bucketId}`);
  }
}

function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...walkDir(full));
    else results.push(full);
  }
  return results;
}

function guessMime(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif',  webp: 'image/webp', svg: 'image/svg+xml',
    pdf: 'application/pdf',
    json: 'application/json',
    txt: 'text/plain', csv: 'text/csv', html: 'text/html',
    mp4: 'video/mp4',  webm: 'video/webm',
    gpx: 'application/gpx+xml',
  };
  return map[ext] ?? 'application/octet-stream';
}

// ── 4. auth ───────────────────────────────────────────────────────────────────

async function restoreAuth() {
  console.log('👤   Auth users …');

  const usersFile = join(backupDir, 'auth', 'users.json');
  if (!existsSync(usersFile)) {
    console.warn('    ⚠️  auth/users.json not found — skipping');
    return;
  }

  const users = JSON.parse(readFileSync(usersFile, 'utf8'));
  if (users.length === 0) {
    console.log('    ℹ️   no users in backup');
    return;
  }

  // fetch existing user IDs so we can skip them
  const existingIds = new Set();
  try {
    let page = 1;
    while (true) {
      const data = await getJSON(
        `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`
      );
      const existing = data?.users ?? data;
      if (!Array.isArray(existing) || existing.length === 0) break;
      existing.forEach(u => existingIds.add(u.id));
      if (existing.length < 1000) break;
      page++;
    }
  } catch (err) {
    console.warn('    ⚠️  could not fetch existing users, will attempt all:', err.message);
  }

  let created = 0, skipped = 0, failed = 0;

  for (const user of users) {
    if (existingIds.has(user.id)) {
      skipped++;
      continue;
    }

    const payload = {
      id:               user.id,
      email:            user.email,
      phone:            user.phone || undefined,
      email_confirm:    !!user.email_confirmed_at,
      phone_confirm:    !!user.phone_confirmed_at,
      user_metadata:    user.user_metadata ?? {},
      app_metadata:     user.app_metadata  ?? {},
      role:             user.role || 'authenticated',
      ban_duration:     user.banned_until ? 'none' : undefined,
    };

    const res = await post(
      `${SUPABASE_URL}/auth/v1/admin/users`,
      payload,
      { 'apikey': SERVICE_ROLE_KEY }
    );

    if (res.ok) {
      created++;
    } else {
      const body = await res.text();
      // "User already exists" is fine — counts as skipped
      if (body.includes('already') || res.status === 422) {
        skipped++;
      } else {
        console.error(`    ❌  ${user.email}: ${res.status} ${body}`);
        failed++;
      }
    }
  }

  console.log(`    ✅  ${created} created, ${skipped} skipped (already exist), ${failed} failed`);
  if (created > 0) {
    console.log('    ℹ️   Restored users have no password — they must sign in via magic link or reset password');
  }
}

// ── run ───────────────────────────────────────────────────────────────────────

(async () => {
  try {
    if (shouldRun('database'))  await restoreDatabase();
    if (shouldRun('functions')) await restoreFunctions();
    if (shouldRun('storage'))   await restoreStorage();
    if (shouldRun('auth'))      await restoreAuth();
    console.log('\n✅  Restore complete\n');
  } catch (err) {
    console.error('\n❌  Restore failed:', err);
    process.exit(1);
  }
})();
