import { describe, it, expect, beforeEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Behavioural RLS check in an in-process Postgres (PGlite); never touches production.
// SpotManager reads and writes dirtparks with the user's JWT, i.e. as role `authenticated`.

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')
const migration = (suffix: string) => {
  const file = readdirSync(MIGRATIONS).find(f => f.endsWith(suffix))
  if (!file) throw new Error(`missing migration *${suffix}`)
  return readFileSync(join(MIGRATIONS, file), 'utf8')
}

const CREW = '00000000-0000-0000-0000-0000000000c1'
const OTHER = '00000000-0000-0000-0000-0000000000c2'

// Mirrors dirt_parks / dirt_park_details + their policies from 20260514075528_remote_schema.sql.
// can_edit_spot is stubbed: CREW may edit dirt-1 only.
const SUPABASE_STUB = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;
  CREATE FUNCTION public.can_edit_spot(spot_id text) RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT current_setting('request.jwt.claim.sub', true) = '${CREW}' AND spot_id = 'dirt-1'
  $$;
  CREATE TABLE public.dirt_parks (
    id text PRIMARY KEY, name text NOT NULL DEFAULT '', url text DEFAULT '',
    latitude real NOT NULL, longitude real NOT NULL, approved boolean NOT NULL DEFAULT false,
    pumptrack boolean DEFAULT false, dirtpark boolean DEFAULT false
  );
  CREATE POLICY "add parks" ON public.dirt_parks FOR INSERT TO anon WITH CHECK (true);
  CREATE POLICY "get parks" ON public.dirt_parks FOR SELECT TO anon USING (true);
  ALTER TABLE public.dirt_parks ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON TABLE public.dirt_parks TO anon, authenticated, service_role;

  CREATE TABLE public.dirt_park_details (
    id text PRIMARY KEY REFERENCES public.dirt_parks(id) ON DELETE CASCADE,
    status text, status_hint text, opening_hours text, rules jsonb, trails_descriptions jsonb,
    last_update timestamptz NOT NULL DEFAULT now()
  );
  CREATE POLICY "add dirt park details" ON public.dirt_park_details FOR INSERT TO anon WITH CHECK (true);
  CREATE POLICY "get details" ON public.dirt_park_details FOR SELECT TO anon USING (true);
  CREATE POLICY "update" ON public.dirt_park_details FOR UPDATE TO anon USING (true);
  ALTER TABLE public.dirt_park_details ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON TABLE public.dirt_park_details TO anon, authenticated, service_role;

  INSERT INTO public.dirt_parks (id, name, latitude, longitude, approved, pumptrack, dirtpark) VALUES
    ('dirt-1', 'Dirtpark A', 50, 10, true, true, false),
    ('dirt-2', 'Dirtpark B', 51, 11, true, false, true);
  INSERT INTO public.dirt_park_details (id, status) VALUES ('dirt-2', 'open');
`

let db: PGlite

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${user ?? ''}', false);`)
  await db.exec(`SET ROLE ${user ? 'authenticated' : 'anon'}`)
  try {
    return await db.query<Record<string, unknown>>(sql, params)
  } finally {
    await db.exec('RESET ROLE')
  }
}

const kind = (id: string) => db.query<{ pumptrack: boolean; dirtpark: boolean }>(
  'SELECT pumptrack, dirtpark FROM public.dirt_parks WHERE id = $1', [id]).then(r => r.rows[0])

beforeEach(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  await db.exec(migration('_spotmanager_dirtparks.sql'))
})

describe('dirt_parks SELECT', () => {
  it('returns dirtparks to logged-in users (SpotManager picker)', async () => {
    const { rows } = await as(CREW, 'SELECT id FROM public.dirt_parks ORDER BY id')
    expect(rows).toEqual([{ id: 'dirt-1' }, { id: 'dirt-2' }])
  })

  it('still returns dirtparks to anonymous visitors (map)', async () => {
    const { rows } = await as(null, 'SELECT id FROM public.dirt_parks ORDER BY id')
    expect(rows).toHaveLength(2)
  })
})

describe('dirt_park_details writes', () => {
  it('lets trailcrew insert details for an assigned dirtpark', async () => {
    await as(CREW, `INSERT INTO public.dirt_park_details (id, status, trail_description) VALUES ('dirt-1', 'closed', 'Nass')`)
    const { rows } = await as(null, `SELECT status, trail_description FROM public.dirt_park_details WHERE id = 'dirt-1'`)
    expect(rows).toEqual([{ status: 'closed', trail_description: 'Nass' }])
  })

  it('rejects anon inserts and ignores anon updates (was USING (true))', async () => {
    await expect(as(null, `INSERT INTO public.dirt_park_details (id, status) VALUES ('dirt-1', 'closed')`))
      .rejects.toThrow(/row-level security/)
    await as(null, `UPDATE public.dirt_park_details SET status = 'closed' WHERE id = 'dirt-2'`)
    expect((await db.query(`SELECT status FROM public.dirt_park_details WHERE id = 'dirt-2'`)).rows).toEqual([{ status: 'open' }])
  })

  it('does not let trailcrew write an unassigned dirtpark', async () => {
    await expect(as(OTHER, `INSERT INTO public.dirt_park_details (id, status) VALUES ('dirt-1', 'closed')`))
      .rejects.toThrow(/row-level security/)
    const { rows } = await as(CREW, `UPDATE public.dirt_park_details SET status = 'closed' WHERE id = 'dirt-2' RETURNING id`)
    expect(rows).toEqual([])
  })
})

describe('set_dirtpark_kind', () => {
  it('sets both flags for an editor', async () => {
    await as(CREW, `SELECT public.set_dirtpark_kind('dirt-1', false, true)`)
    expect(await kind('dirt-1')).toEqual({ pumptrack: false, dirtpark: true })
  })

  it('rejects non-editors and anon', async () => {
    await expect(as(OTHER, `SELECT public.set_dirtpark_kind('dirt-1', false, true)`)).rejects.toThrow(/forbidden/)
    await expect(as(null, `SELECT public.set_dirtpark_kind('dirt-1', false, true)`)).rejects.toThrow(/permission denied/)
    expect(await kind('dirt-1')).toEqual({ pumptrack: true, dirtpark: false })
  })

  it('requires at least one kind', async () => {
    await expect(as(CREW, `SELECT public.set_dirtpark_kind('dirt-1', false, false)`)).rejects.toThrow(/kind_required/)
  })
})
