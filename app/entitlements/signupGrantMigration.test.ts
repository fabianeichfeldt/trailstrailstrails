import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// STRUCTURAL CHECK ONLY. There is no local Postgres harness, so this reads the
// migration text and pins the properties that must not regress. It does not
// prove the SQL runs.
const dir = join(process.cwd(), 'supabase', 'migrations')
const file = readdirSync(dir).find((f) => f.endsWith('_grant_free_plus_on_signup.sql'))
const sql = file ? readFileSync(join(dir, file), 'utf8') : ''
// Code only: comments may mention plan names freely.
const code = sql.replace(/--.*$/gm, '')

describe('signup free-access grant migration (structural)', () => {
  it('exists and sorts after the entitlements migration', () => {
    expect(file).toBeDefined()
    expect(file! > '20260923172739').toBe(true)
  })

  it('fires AFTER INSERT on auth.users, per row', () => {
    expect(code).toMatch(/CREATE\s+TRIGGER\s+\S+\s+AFTER\s+INSERT\s+ON\s+"?auth"?\."?users"?\s+FOR\s+EACH\s+ROW/i)
  })

  it('is SECURITY DEFINER with an empty search_path, owned by postgres', () => {
    expect(code).toMatch(/SECURITY\s+DEFINER/i)
    expect(code).toMatch(/SET\s+"?search_path"?\s+(TO|=)\s+''/i)
    expect(code).toMatch(/OWNER\s+TO\s+"postgres"/i)
  })

  it('is idempotent and can never make signup fail', () => {
    expect(code).toMatch(/ON\s+CONFLICT\s*\(\s*"?user_id"?\s*\)\s+DO\s+NOTHING/i)
    expect(code).toMatch(/EXCEPTION\s+WHEN\s+OTHERS\s+THEN/i)
    expect(code).toMatch(/RAISE\s+WARNING/i)
    // No qualifying plan -> skip, do not raise.
    expect(code).not.toMatch(/RAISE\s+EXCEPTION/i)
  })

  it('picks the plan in SQL — active, level >= 1, lowest level — with no hardcoded plan id', () => {
    expect(code).not.toMatch(/'(pro|supporter|plus)'/i)
    expect(code).toMatch(/active/i)
    expect(code).toMatch(/level"?\s*>=\s*1/i)
    expect(code).toMatch(/ORDER\s+BY\s+[\w".]*level"?\s+ASC/i)
    expect(code).toMatch(/LIMIT\s+1/i)
  })

  it('grants six months with a discount of 0, both as easy-to-find constants', () => {
    expect(code).toMatch(/free_period\s+interval\s*:=\s*interval\s+'6 months'/i)
    expect(code).toMatch(/free_discount_pct\s+int\s*:=\s*0\s*;/i)
    expect(code).toMatch(/VALUES\s*\([^;]*free_discount_pct/i)
    // Constants are documented at the top, before any statement.
    expect(sql.indexOf('TUNABLES')).toBeLessThan(sql.indexOf('CREATE OR REPLACE FUNCTION'))
    expect(sql).toMatch(/rolling/i)
  })

  it('backfills existing users without a grant row', () => {
    expect(code).toMatch(/PERFORM\s+"?public"?\."?grant_free_access"?\([^)]*\)\s+FROM\s+"?auth"?\."?users"?[\s\S]*NOT\s+EXISTS[\s\S]*early_adopter_grants/i)
  })
})
