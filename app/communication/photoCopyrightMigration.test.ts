import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { COPYRIGHT_MAX_LENGTH } from '../utils/photoCopyright'

// STRUCTURAL CHECK ONLY (no local Postgres harness) — pins what must not regress.
const dir = join(process.cwd(), 'supabase', 'migrations')
const file = readdirSync(dir).find((f) => f.endsWith('_add_trail_photo_copyright.sql'))
const sql = file ? readFileSync(join(dir, file), 'utf8') : ''
const code = sql.replace(/--.*$/gm, '')

describe('trail photo copyright migration (structural)', () => {
  it('adds a nullable copyright column whose length cap matches the client', () => {
    expect(file).toBeDefined()
    expect(code).toMatch(/ADD\s+COLUMN\s+(IF\s+NOT\s+EXISTS\s+)?"?copyright"?\s+text/i)
    expect(code).toMatch(new RegExp(`char_length\\("?copyright"?\\)\\s*<=\\s*${COPYRIGHT_MAX_LENGTH}`, 'i'))
  })

  it('lets only the uploader update a photo row', () => {
    expect(code).toMatch(/CREATE\s+POLICY[^;]*ON\s+"?public"?\."?trail_photos"?\s+FOR\s+UPDATE\s+TO\s+"?authenticated"?[^;]*USING\s*\(\s*\(?auth\.uid\(\)\)?\s*=\s*"?creator"?\s*\)[^;]*WITH\s+CHECK\s*\(\s*\(?auth\.uid\(\)\)?\s*=\s*"?creator"?\s*\)/i)
  })

  it('restricts UPDATE to the copyright column, so url/trail_id/creator stay immutable', () => {
    expect(code).toMatch(/REVOKE\s+UPDATE\s+ON\s+(TABLE\s+)?"?public"?\."?trail_photos"?\s+FROM\s+"?anon"?\s*,\s*"?authenticated"?/i)
    expect(code).toMatch(/GRANT\s+UPDATE\s*\(\s*"?copyright"?\s*\)\s+ON\s+(TABLE\s+)?"?public"?\."?trail_photos"?\s+TO\s+"?authenticated"?/i)
  })
})
