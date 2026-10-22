import { describe, it, expect, beforeEach } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Schema check for external-source identity on spot_gpx_trails, run in an in-process
// Postgres (PGlite). Never touches the production database.

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')
const migration = (suffix: string) => {
  const file = readdirSync(MIGRATIONS).find(f => f.endsWith(suffix))
  if (!file) throw new Error(`missing migration *${suffix}`)
  return readFileSync(join(MIGRATIONS, file), 'utf8')
}

// Mirrors the columns of spot_gpx_trails that the insert touches (20260514075528_remote_schema.sql).
const SUPABASE_STUB = `
  CREATE TABLE public.spot_gpx_trails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    spot_id text NOT NULL,
    name text NOT NULL,
    difficulty text NOT NULL,
    direction text NOT NULL,
    gpx_points jsonb NOT NULL
  );
`

let db: PGlite

const insertTrail = (name: string, source: string | null, sourceId: string | null) =>
  db.query(
    `INSERT INTO public.spot_gpx_trails (spot_id, name, difficulty, direction, gpx_points, source, source_id)
     VALUES ('spot-1', $1, 'blue', 'one_way_down', '[]', $2, $3)`,
    [name, source, sourceId],
  )

beforeEach(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  await db.exec(migration('_spot_gpx_trails_source.sql'))
})

describe('spot_gpx_trails external source identity', () => {
  it('rejects a second row with the same (source, source_id)', async () => {
    await insertTrail('BW Trail A', 'bw_2m', 'guid-1')
    await expect(insertTrail('BW Trail A copy', 'bw_2m', 'guid-1'))
      .rejects.toThrow(/duplicate key|unique/)
  })

  it('allows many hand-made rows with source NULL', async () => {
    await insertTrail('Hand made 1', null, null)
    await insertTrail('Hand made 2', null, null)
    const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.spot_gpx_trails')
    expect(rows[0]!.n).toBe(2)
  })

  it('rejects source set while source_id is null', async () => {
    await expect(insertTrail('Half set', 'bw_2m', null))
      .rejects.toThrow(/spot_gpx_trails_source_pair/)
  })

  it('rejects source_id set while source is null', async () => {
    await expect(insertTrail('Half set', null, 'guid-2'))
      .rejects.toThrow(/spot_gpx_trails_source_pair/)
  })

  it('keeps the same source_id unique per source only', async () => {
    await insertTrail('BW Trail A', 'bw_2m', 'guid-1')
    await expect(insertTrail('Other source', 'other', 'guid-1')).resolves.toBeDefined()
  })
})
