import { FUNCTIONS, REST, anonHeaders, userHeaders } from './http'
import type { Subscription, CheckoutEligibility, SupporterPrices } from '~/types/Subscription'

export type BillingInterval = 'monthly' | 'yearly'

export type CheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: 'already_subscribed' }
  | { ok: false; error: 'grant_active'; eligibleFrom: string | null }
  | { ok: false; error: 'unknown' }

export type PortalResult =
  | { ok: true; url: string }
  | { ok: false; error: 'no_customer' | 'unknown' }

export type CancelResult =
  | { ok: true; receivedAt: string }
  | { ok: false; error: 'rate_limited' | 'unknown' }

export type ResumeResult =
  | { ok: true }
  | { ok: false; error: 'nothing_to_resume' | 'unknown' }

export type CancelInput = { jwt: string } | { email: string; name: string }

// Expected outcomes are values, not throws; a network failure or unreadable body is 'unknown'.
async function callBilling(headers: Record<string, string>, body: object): Promise<{ status: number; body: any } | null> {
  try {
    const res = await fetch(`${FUNCTIONS}/billing`, { method: 'POST', headers, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    return { status: res.status, body: json ?? {} }
  } catch {
    return null
  }
}

export async function startCheckout(jwt: string, interval: BillingInterval, mode?: 'test'): Promise<CheckoutResult> {
  const r = await callBilling(userHeaders(jwt), { action: 'checkout', interval, ...(mode ? { mode } : {}) })
  if (!r) return { ok: false, error: 'unknown' }
  if (r.status === 200 && typeof r.body.checkoutUrl === 'string') return { ok: true, checkoutUrl: r.body.checkoutUrl }
  if (r.status === 409 && r.body.error === 'already_subscribed') return { ok: false, error: 'already_subscribed' }
  if (r.status === 409 && r.body.error === 'grant_active') return { ok: false, error: 'grant_active', eligibleFrom: r.body.eligibleFrom ?? null }
  return { ok: false, error: 'unknown' }
}

export async function openPortal(jwt: string): Promise<PortalResult> {
  const r = await callBilling(userHeaders(jwt), { action: 'portal' })
  if (!r) return { ok: false, error: 'unknown' }
  if (r.status === 200 && typeof r.body.url === 'string') return { ok: true, url: r.body.url }
  if (r.status === 404) return { ok: false, error: 'no_customer' }
  return { ok: false, error: 'unknown' }
}

export async function cancelSubscription(input: CancelInput): Promise<CancelResult> {
  const r = 'jwt' in input
    ? await callBilling(userHeaders(input.jwt), { action: 'cancel' })
    : await callBilling(anonHeaders(), { action: 'cancel', email: input.email, name: input.name })
  if (!r) return { ok: false, error: 'unknown' }
  if (r.status === 200 && r.body.ok) return { ok: true, receivedAt: r.body.receivedAt }
  if (r.status === 429) return { ok: false, error: 'rate_limited' }
  return { ok: false, error: 'unknown' }
}

export async function resumeSubscription(jwt: string): Promise<ResumeResult> {
  const r = await callBilling(userHeaders(jwt), { action: 'resume' })
  if (!r) return { ok: false, error: 'unknown' }
  if (r.status === 200 && r.body.ok) return { ok: true }
  if (r.status === 409) return { ok: false, error: 'nothing_to_resume' }
  return { ok: false, error: 'unknown' }
}

export async function getMySubscription(jwt: string): Promise<Subscription | null> {
  try {
    const res = await fetch(
      `${REST}/subscriptions?status=in.(active,trialing,past_due)&order=created_at.desc&limit=1&select=id,plan_id,provider,status,current_period_end,cancel_at_period_end,provider_customer_id,customer_email,created_at`,
      { headers: userHeaders(jwt) },
    )
    if (!res.ok) return null
    const rows = await res.json()
    const row = Array.isArray(rows) ? rows[0] : undefined
    if (!row) return null
    return {
      id: row.id,
      planId: row.plan_id,
      provider: row.provider,
      status: row.status,
      currentPeriodEnd: row.current_period_end ?? null,
      cancelAtPeriodEnd: !!row.cancel_at_period_end,
      hasCustomer: !!row.provider_customer_id,
      customerEmail: row.customer_email ?? null,
      createdAt: row.created_at,
    }
  } catch {
    return null
  }
}

// Fails closed: an unknown state must not invite a purchase the server would refuse.
const NOT_ELIGIBLE: CheckoutEligibility = { eligible: false, reason: 'unknown', eligibleFrom: null }

export async function getCheckoutEligibility(jwt: string): Promise<CheckoutEligibility> {
  try {
    const res = await fetch(`${REST}/rpc/get_my_checkout_eligibility`, {
      method: 'POST', headers: userHeaders(jwt), body: '{}',
    })
    if (!res.ok) return NOT_ELIGIBLE
    const rows = await res.json()
    const row = Array.isArray(rows) ? rows[0] : undefined
    if (!row) return NOT_ELIGIBLE
    return { eligible: !!row.eligible, reason: row.reason ?? null, eligibleFrom: row.eligible_from ?? null }
  } catch {
    return NOT_ELIGIBLE
  }
}

export async function getSupporterPrices(): Promise<SupporterPrices | null> {
  try {
    const res = await fetch(
      `${REST}/subscription_plans?id=eq.plus&select=price_monthly_cents,price_yearly_cents,currency`,
      { headers: anonHeaders() },
    )
    if (!res.ok) return null
    const rows = await res.json()
    const row = Array.isArray(rows) ? rows[0] : undefined
    if (!row) return null
    return { monthlyCents: row.price_monthly_cents, yearlyCents: row.price_yearly_cents, currency: row.currency }
  } catch {
    return null
  }
}
