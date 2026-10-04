import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// STRUCTURAL CHECK ONLY (no local Postgres harness) — pins what must not regress.
const dir = join(process.cwd(), 'supabase', 'migrations')
const file = readdirSync(dir).find((f) => f.endsWith('_crew_free_access.sql'))
const sql = file ? readFileSync(join(dir, file), 'utf8') : ''
const code = sql.replace(/--.*$/gm, '')

describe('crew free-access migration (structural)', () => {
  it('exists and sorts after the Creem billing migration (last get_my_entitlement redefinition)', () => {
    expect(file).toBeDefined()
    expect(file! > '20261003120000').toBe(true)
  })

  it('redefines get_my_entitlement with a crew_role column, SECURITY DEFINER, empty search_path, owned by postgres', () => {
    expect(code).toMatch(/DROP\s+FUNCTION\s+(IF\s+EXISTS\s+)?"?public"?\."?get_my_entitlement"?\(\)/i)
    expect(code).toMatch(/RETURNS\s+TABLE\([^)]*"crew_role"\s+text/i)
    expect(code).toMatch(/SECURITY\s+DEFINER/i)
    expect(code).toMatch(/SET\s+"?search_path"?\s+(TO|=)\s+''/i)
    expect(code).toMatch(/OWNER\s+TO\s+"postgres"/i)
  })

  it('grants trailcrew and admin from user_roles, with no expiry and no hardcoded plan id', () => {
    expect(code).toMatch(/"?public"?\."?user_roles"?/i)
    expect(code).toMatch(/'trailcrew'/)
    expect(code).toMatch(/'admin'/)
    expect(code).not.toMatch(/'(pro|supporter|plus)'/i)
  })

  it('keeps past_due as a live subscription and the unexpired early-adopter grant', () => {
    expect(code).toMatch(/'active',\s*'trialing',\s*'past_due'/)
    expect(code).toMatch(/free_until"?\s*>\s*now\(\)/i)
  })

  it('on a level tie prefers subscription, then crew, then the dated grant', () => {
    expect(code).toMatch(/ORDER\s+BY\s+[\w".]*level"?\s+DESC\s*,/i)
  })
})
