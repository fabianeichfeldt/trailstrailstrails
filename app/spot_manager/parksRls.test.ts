import { describe, it, expect, beforeEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Behavioural RLS check in an in-process Postgres (PGlite); never touches production.
// The SpotManager lists parks with the user's JWT, i.e. as role `authenticated`.

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')
const migration = (suffix: string) => {
  const file = readdirSync(MIGRATIONS).find(f => f.endsWith(suffix))
  if (!file) throw new Error(`missing migration *${suffix}`)
  return readFileSync(join(MIGRATIONS, file), 'utf8')
}

const ADMIN = '00000000-0000-0000-0000-0000000000a1'

// Mirrors parks + its policies from 20260514075528_remote_schema.sql.
const SUPABASE_STUB = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;
  CREATE TABLE public.parks (
    id text PRIMARY KEY, name text NOT NULL DEFAULT '', url text DEFAULT '',
    latitude real NOT NULL, longitude real NOT NULL, approved boolean NOT NULL DEFAULT false
  );
  CREATE POLICY "insert" ON public.parks FOR INSERT TO anon, service_role WITH CHECK (true);
  CREATE POLICY "select" ON public.parks FOR SELECT TO anon, service_role USING (true);
  ALTER TABLE public.parks ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON TABLE public.parks TO anon, authenticated, service_role;
  INSERT INTO public.parks (id, name, latitude, longitude, approved) VALUES ('park-1', 'Bikepark A', 50, 10, true);
`

let db: PGlite

async function as(role: 'anon' | 'authenticated', sql: string) {
  await db.exec(`SET ROLE ${role}`)
  try {
    return await db.query<Record<string, unknown>>(sql)
  } finally {
    await db.exec('RESET ROLE')
  }
}

beforeEach(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  await db.exec(migration('_parks_select_authenticated.sql'))
})

describe('parks SELECT', () => {
  it('returns parks to logged-in users (SpotManager picker)', async () => {
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${ADMIN}', false)`)
    const { rows } = await as('authenticated', 'SELECT id, name FROM public.parks')
    expect(rows).toEqual([{ id: 'park-1', name: 'Bikepark A' }])
  })

  it('still returns parks to anonymous visitors (map)', async () => {
    const { rows } = await as('anon', 'SELECT id FROM public.parks')
    expect(rows).toEqual([{ id: 'park-1' }])
  })

  it('does not open writes to logged-in users', async () => {
    await expect(as('authenticated', `UPDATE public.parks SET name = 'x' RETURNING id`))
      .resolves.toMatchObject({ rows: [] })
    await expect(as('authenticated', `INSERT INTO public.parks (id, latitude, longitude) VALUES ('p2', 1, 1)`))
      .rejects.toThrow(/row-level security/)
  })
})
