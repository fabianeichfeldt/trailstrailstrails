/**
 * Supabase full backup script (free-tier safe)
 *
 * Covers: database schema + data (pg_dump), edge functions, storage, auth users
 *
 * External tools required (besides Node ≥ 18):
 *   pg_dump   — part of libpq/postgresql-client, used for DB schema + data dumps
 *               macOS:  brew install libpq && brew link --force libpq
 *               Linux:  apt install postgresql-client
 *               Only needed if SUPABASE_DB_PASSWORD is set; gracefully skipped otherwise.
 *
 * Required env vars:
 *   SUPABASE_URL              — https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — for storage / auth admin APIs (also accepts SUPABASE_SERVICE_KEY)
 *   SUPABASE_DB_PASSWORD      — postgres password for pg_dump (skip to omit DB backup)
 *   SUPABASE_ACCESS_TOKEN     — personal access token for Management API (functions)
 *
 * Usage:  node --env-file=.env backup.js [output-dir]
 */

import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';

// ── config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL          = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SERVICE_ROLE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const DB_PASSWORD           = process.env.SUPABASE_DB_PASSWORD;
const ACCESS_TOKEN          = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

// derive project ref from URL  (https://<ref>.supabase.co)
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];

// backup root
const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupRoot = process.argv[2] || join('backups', timestamp);

mkdirSync(join(backupRoot, 'functions'),        { recursive: true });
mkdirSync(join(backupRoot, 'storage'),          { recursive: true });
mkdirSync(join(backupRoot, 'auth'),             { recursive: true });
mkdirSync(join(backupRoot, 'database'),         { recursive: true });

console.log(`\n📦  Backup → ${backupRoot}\n`);

// ── helpers ───────────────────────────────────────────────────────────────────

async function api(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, ...headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}  (${url})`);
  return res;
}

async function apiJSON(url, headers = {}) {
  return (await api(url, headers)).json();
}

function save(path, data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  writeFileSync(path, content, 'utf8');
}

// ── 1. database ───────────────────────────────────────────────────────────────

async function backupDatabase() {
  console.log('🗄️   Database …');

  const pgDumpAvailable = spawnSync('which', ['pg_dump']).status === 0;

  if (!DB_PASSWORD) {
    console.warn('    ⚠️  SUPABASE_DB_PASSWORD not set — skipping pg_dump');
  } else if (!pgDumpAvailable) {
    console.warn('    ⚠️  pg_dump not found — skipping database dump');
    console.warn('       Install: brew install libpq && brew link --force libpq');
  } else {
    const host = `db.${PROJECT_REF}.supabase.co`;
    const connStr = `postgresql://postgres:${DB_PASSWORD}@${host}:5432/postgres`;

    // schema-only (DDL)
    try {
      const schema = execSync(
        `pg_dump --schema-only --no-owner --no-acl "${connStr}"`,
        { env: { ...process.env, PGPASSWORD: DB_PASSWORD }, maxBuffer: 50 * 1024 * 1024 }
      );
      save(join(backupRoot, 'database', 'schema.sql'), schema.toString());
      console.log('    ✅  schema.sql');
    } catch (err) {
      console.error('    ❌  schema dump failed:', err.message);
    }

    // full data dump
    try {
      const data = execSync(
        `pg_dump --data-only --no-owner --no-acl "${connStr}"`,
        { env: { ...process.env, PGPASSWORD: DB_PASSWORD }, maxBuffer: 200 * 1024 * 1024 }
      );
      save(join(backupRoot, 'database', 'data.sql'), data.toString());
      console.log('    ✅  data.sql');
    } catch (err) {
      console.error('    ❌  data dump failed:', err.message);
    }

    // combined full dump (restore-ready)
    try {
      const full = execSync(
        `pg_dump --no-owner --no-acl "${connStr}"`,
        { env: { ...process.env, PGPASSWORD: DB_PASSWORD }, maxBuffer: 200 * 1024 * 1024 }
      );
      save(join(backupRoot, 'database', 'full.sql'), full.toString());
      console.log('    ✅  full.sql');
    } catch (err) {
      console.error('    ❌  full dump failed:', err.message);
    }
  }
}

// ── 2. edge functions ─────────────────────────────────────────────────────────

async function backupFunctions() {
  console.log('⚡️   Edge functions …');

  if (!ACCESS_TOKEN) {
    console.warn('    ⚠️  SUPABASE_ACCESS_TOKEN not set — skipping functions');
    return;
  }

  const mgmtHeaders = { 'Authorization': `Bearer ${ACCESS_TOKEN}` };

  let functions;
  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`,
      { headers: mgmtHeaders }
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    functions = await res.json();
  } catch (err) {
    console.error('    ❌  could not list functions:', err.message);
    return;
  }

  if (!Array.isArray(functions) || functions.length === 0) {
    console.log('    ℹ️   no functions found');
    return;
  }

  // save function metadata
  save(join(backupRoot, 'functions', '_index.json'), functions);

  for (const fn of functions) {
    const slug = fn.slug;
    try {
      const bodyRes = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/${slug}/body`,
        { headers: mgmtHeaders }
      );
      if (!bodyRes.ok) throw new Error(`${bodyRes.status} ${bodyRes.statusText}`);
      const body = await bodyRes.text();
      const dir = join(backupRoot, 'functions', slug);
      mkdirSync(dir, { recursive: true });
      save(join(dir, 'index.ts'), body);
      save(join(dir, 'meta.json'), fn);
      console.log(`    ✅  ${slug}`);
    } catch (err) {
      console.error(`    ❌  ${slug}: ${err.message}`);
    }
  }
}

// ── 3. storage ────────────────────────────────────────────────────────────────

async function backupStorage() {
  console.log('🪣   Storage …');

  let buckets;
  try {
    buckets = await apiJSON(`${SUPABASE_URL}/storage/v1/bucket`);
  } catch (err) {
    console.error('    ❌  could not list buckets:', err.message);
    return;
  }

  if (!Array.isArray(buckets) || buckets.length === 0) {
    console.log('    ℹ️   no buckets found');
    return;
  }

  save(join(backupRoot, 'storage', '_buckets.json'), buckets);

  for (const bucket of buckets) {
    const bucketId   = bucket.id;
    const bucketDir  = join(backupRoot, 'storage', bucketId);
    mkdirSync(bucketDir, { recursive: true });

    // recursively list all objects
    const allObjects = await listStorageObjects(bucketId, '');
    save(join(bucketDir, '_objects.json'), allObjects);

    console.log(`    bucket: ${bucketId} (${allObjects.length} objects)`);

    for (const obj of allObjects) {
      try {
        const filePath = obj.name;
        const res = await api(`${SUPABASE_URL}/storage/v1/object/${bucketId}/${filePath}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const dest = join(bucketDir, filePath);
        mkdirSync(join(dest, '..'), { recursive: true });
        writeFileSync(dest, buffer);
      } catch (err) {
        console.error(`      ❌  ${obj.name}: ${err.message}`);
      }
    }
    console.log(`    ✅  ${bucketId}`);
  }
}

async function listStorageObjects(bucket, prefix) {
  const body = JSON.stringify({ prefix, limit: 1000, offset: 0 });
  const res  = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  if (!res.ok) return [];

  const items = await res.json();
  const results = [];

  for (const item of items) {
    if (item.id === null) {
      // folder — recurse
      const nested = await listStorageObjects(bucket, `${prefix}${item.name}/`);
      results.push(...nested);
    } else {
      results.push({ ...item, name: `${prefix}${item.name}` });
    }
  }
  return results;
}

// ── 4. auth ───────────────────────────────────────────────────────────────────

async function backupAuth() {
  console.log('👤   Auth users …');

  const allUsers = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    let data;
    try {
      data = await apiJSON(
        `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
        { 'apikey': SERVICE_ROLE_KEY }
      );
    } catch (err) {
      console.error('    ❌  could not fetch users:', err.message);
      break;
    }

    const users = data?.users ?? data;
    if (!Array.isArray(users) || users.length === 0) break;
    allUsers.push(...users);
    if (users.length < perPage) break;
    page++;
  }

  // strip sensitive fields before saving
  const sanitized = allUsers.map(u => ({
    id:                  u.id,
    email:               u.email,
    phone:               u.phone,
    created_at:          u.created_at,
    updated_at:          u.updated_at,
    last_sign_in_at:     u.last_sign_in_at,
    email_confirmed_at:  u.email_confirmed_at,
    phone_confirmed_at:  u.phone_confirmed_at,
    role:                u.role,
    app_metadata:        u.app_metadata,
    user_metadata:       u.user_metadata,
    identities:          u.identities,
    banned_until:        u.banned_until,
  }));

  save(join(backupRoot, 'auth', 'users.json'), sanitized);
  console.log(`    ✅  ${sanitized.length} users`);
}

// ── 5. manifest ───────────────────────────────────────────────────────────────

function writeManifest() {
  save(join(backupRoot, 'manifest.json'), {
    project_ref: PROJECT_REF,
    supabase_url: SUPABASE_URL,
    created_at: new Date().toISOString(),
    sections: ['database', 'functions', 'storage', 'auth'],
  });
}

// ── run ───────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await backupDatabase();
    await backupFunctions();
    await backupStorage();
    await backupAuth();
    writeManifest();
    console.log(`\n✅  Backup complete → ${backupRoot}\n`);
  } catch (err) {
    console.error('\n❌  Backup failed:', err);
    process.exit(1);
  }
})();
