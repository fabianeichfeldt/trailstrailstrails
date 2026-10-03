import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// STRUCTURAL CHECK ONLY. No local Postgres harness: this pins the properties of
// the Creem billing migration that must not regress. It does not prove the SQL runs.
const dir = join(process.cwd(), 'supabase', 'migrations')
const file = readdirSync(dir).find((f) => f.endsWith('_add_creem_billing.sql'))
const sql = file ? readFileSync(join(dir, file), 'utf8') : ''
const code = sql.replace(/--.*$/gm, '')

// One CREATE [OR REPLACE] FUNCTION statement: from its header through the closing $$;
function fn(name: string): string {
  const m = code.match(new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+"?public"?\\."?${name}"?\\([\\s\\S]*?AS\\s+\\$\\$[\\s\\S]*?\\$\\$;`, 'i'))
  return m ? m[0] : ''
}

describe('creem billing migration (structural)', () => {
  it('exists and sorts after the entitlements and plan-rename migrations', () => {
    expect(file).toBeDefined()
    expect(file! > '20261002120000').toBe(true)
  })

  it('adds the provider columns to subscriptions', () => {
    for (const col of ['provider_customer_id', 'customer_email', 'provider_updated_at']) {
      expect(code).toMatch(new RegExp(`ADD\\s+COLUMN\\s+"?${col}"?`, 'i'))
    }
  })

  // Non-partial on purpose: PostgREST's on_conflict cannot target a partial index.
  it('has a plain unique index on (provider, provider_subscription_id)', () => {
    const idx = code.match(/CREATE\s+UNIQUE\s+INDEX\s+"?subscriptions_provider_sub_id"?[^;]*;/i)?.[0] ?? ''
    expect(idx).toMatch(/\(\s*"?provider"?\s*,\s*"?provider_subscription_id"?\s*\)/i)
    expect(idx).not.toMatch(/WHERE/i)
  })

  it('recreates one_active_subscription_per_user including past_due', () => {
    expect(code).toMatch(/DROP\s+INDEX\s+(IF\s+EXISTS\s+)?"?public"?\."?one_active_subscription_per_user"?/i)
    expect(code).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+"?one_active_subscription_per_user"?[\s\S]*?IN\s*\(\s*'active'\s*,\s*'trialing'\s*,\s*'past_due'\s*\)/i)
  })

  it('replaces get_my_entitlement counting past_due, still definer with empty search_path', () => {
    const body = fn('get_my_entitlement')
    expect(body).not.toBe('')
    expect(body).toMatch(/status"?\s+IN\s*\(\s*'active'\s*,\s*'trialing'\s*,\s*'past_due'\s*\)/i)
    expect(body).toMatch(/SECURITY\s+DEFINER/i)
    expect(body).toMatch(/SET\s+"?search_path"?\s+TO\s+''/i)
  })

  it.each(['billing_events', 'cancel_requests'])('%s exists with RLS enabled and no policies', (t) => {
    expect(code).toMatch(new RegExp(`CREATE\\s+TABLE\\s+"?public"?\\."?${t}"?`, 'i'))
    expect(code).toMatch(new RegExp(`ALTER\\s+TABLE\\s+"?public"?\\."?${t}"?\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i'))
    expect(code).not.toMatch(new RegExp(`CREATE\\s+POLICY[^;]*ON\\s+"?public"?\\."?${t}"?`, 'i'))
  })

  it('can_start_checkout is definer, pinned, 14-day rule, three outcomes, service-role only', () => {
    const body = fn('can_start_checkout')
    expect(body).not.toBe('')
    expect(body).toMatch(/SECURITY\s+DEFINER/i)
    expect(body).toMatch(/SET\s+"?search_path"?\s+TO\s+''/i)
    expect(body).toMatch(/interval\s+'14 days'/i)
    expect(body).toMatch(/'already_subscribed'/)
    expect(body).toMatch(/'grant_active'/)
    expect(body).toMatch(/'past_due'/)
    expect(body).toMatch(/early_adopter_grants/)
    expect(code).toMatch(/REVOKE\s+(ALL|EXECUTE)\s+ON\s+FUNCTION\s+"?public"?\."?can_start_checkout"?\(uuid\)\s+FROM\s+PUBLIC\s*,\s*"?anon"?\s*,\s*"?authenticated"?/i)
  })

  it('get_my_checkout_eligibility wraps can_start_checkout(auth.uid()) for authenticated', () => {
    const body = fn('get_my_checkout_eligibility')
    expect(body).toMatch(/can_start_checkout"?\(\s*auth\.uid\(\)\s*\)/i)
    expect(body).toMatch(/SECURITY\s+DEFINER/i)
    expect(body).toMatch(/SET\s+"?search_path"?\s+TO\s+''/i)
    expect(code).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+"?public"?\."?get_my_checkout_eligibility"?\(\)\s+TO\s+"?authenticated"?/i)
  })

  it('user_id_by_email is definer, pinned, case-insensitive, revoked from anon/authenticated', () => {
    const body = fn('user_id_by_email')
    expect(body).not.toBe('')
    expect(body).toMatch(/SECURITY\s+DEFINER/i)
    expect(body).toMatch(/SET\s+"?search_path"?\s+TO\s+''/i)
    expect(body).toMatch(/lower\(\s*\w*\.?"?email"?\s*\)\s*=\s*lower\(\s*trim\(/i)
    expect(code).toMatch(/REVOKE\s+(ALL|EXECUTE)\s+ON\s+FUNCTION\s+"?public"?\."?user_id_by_email"?\(text\)\s+FROM\s+PUBLIC\s*,\s*"?anon"?\s*,\s*"?authenticated"?/i)
  })

  it('seeds plus prices and creem_test provider prices only (no live rows)', () => {
    expect(code).toMatch(/UPDATE\s+"?public"?\."?subscription_plans"?\s+SET\s+"?price_monthly_cents"?[\s\S]*?"?price_yearly_cents"?[\s\S]*?WHERE\s+"?id"?\s*=\s*'plus'/i)
    expect(code).toMatch(/INSERT\s+INTO\s+"?public"?\."?plan_provider_prices"?/i)
    expect(code).toMatch(/'creem_test'\s*,\s*'monthly'/i)
    expect(code).toMatch(/'creem_test'\s*,\s*'yearly'/i)
    expect(code).not.toMatch(/'creem'\s*,/i)
    expect(sql).toMatch(/PLACEHOLDER/)
  })
})
