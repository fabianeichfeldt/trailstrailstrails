import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  startCheckout, openPortal, cancelSubscription, resumeSubscription,
  getMySubscription, getCheckoutEligibility,
} from './billing'
import { anon } from '../anon'

function res(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

afterEach(() => vi.unstubAllGlobals())

function stub(r: Promise<unknown>) {
  const fetch = vi.fn().mockReturnValue(r)
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('startCheckout', () => {
  it('posts the checkout action with the bearer token and returns the checkout url', async () => {
    const fetch = stub(res(200, { checkoutUrl: 'https://pay.example/c1' }))

    const r = await startCheckout('jwt-1', 'yearly')

    const [url, opts] = fetch.mock.calls[0]
    expect(url).toMatch(/\/functions\/v1\/billing$/)
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer jwt-1')
    expect(JSON.parse(opts.body)).toEqual({ action: 'checkout', interval: 'yearly' })
    expect(r).toEqual({ ok: true, checkoutUrl: 'https://pay.example/c1' })
  })

  it('sends mode: test when asked', async () => {
    const fetch = stub(res(200, { checkoutUrl: 'x' }))
    await startCheckout('jwt-1', 'monthly', 'test')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ action: 'checkout', interval: 'monthly', mode: 'test' })
  })

  it('maps 409 already_subscribed', async () => {
    stub(res(409, { error: 'already_subscribed' }))
    expect(await startCheckout('j', 'monthly')).toEqual({ ok: false, error: 'already_subscribed' })
  })

  it('maps 409 grant_active with eligibleFrom', async () => {
    stub(res(409, { error: 'grant_active', eligibleFrom: '2027-01-01T00:00:00Z' }))
    expect(await startCheckout('j', 'monthly')).toEqual({ ok: false, error: 'grant_active', eligibleFrom: '2027-01-01T00:00:00Z' })
  })

  it('maps 502, a missing checkoutUrl and a network error to unknown', async () => {
    stub(res(502, { error: 'provider_error' }))
    expect(await startCheckout('j', 'monthly')).toEqual({ ok: false, error: 'unknown' })
    stub(res(200, {}))
    expect(await startCheckout('j', 'monthly')).toEqual({ ok: false, error: 'unknown' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await startCheckout('j', 'monthly')).toEqual({ ok: false, error: 'unknown' })
  })
})

describe('openPortal', () => {
  it('posts the portal action and returns the url', async () => {
    const fetch = stub(res(200, { url: 'https://portal.example' }))
    const r = await openPortal('jwt-1')
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ action: 'portal' })
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-1')
    expect(r).toEqual({ ok: true, url: 'https://portal.example' })
  })

  it('maps 404 to no_customer and other failures to unknown', async () => {
    stub(res(404, { error: 'no_customer' }))
    expect(await openPortal('j')).toEqual({ ok: false, error: 'no_customer' })
    stub(res(502, { error: 'provider_error' }))
    expect(await openPortal('j')).toEqual({ ok: false, error: 'unknown' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')))
    expect(await openPortal('j')).toEqual({ ok: false, error: 'unknown' })
  })
})

describe('resumeSubscription', () => {
  it('posts resume and returns ok', async () => {
    const fetch = stub(res(200, { ok: true }))
    expect(await resumeSubscription('jwt-1')).toEqual({ ok: true })
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ action: 'resume' })
  })

  it('maps 409 to nothing_to_resume and others to unknown', async () => {
    stub(res(409, { error: 'nothing_to_resume' }))
    expect(await resumeSubscription('j')).toEqual({ ok: false, error: 'nothing_to_resume' })
    stub(res(502, {}))
    expect(await resumeSubscription('j')).toEqual({ ok: false, error: 'unknown' })
  })
})

describe('cancelSubscription', () => {
  it('with a jwt uses user headers and sends no identity', async () => {
    const fetch = stub(res(200, { ok: true, receivedAt: '2026-10-03T10:00:00Z' }))
    const r = await cancelSubscription({ jwt: 'jwt-1' })
    const [, opts] = fetch.mock.calls[0]
    expect(opts.headers.Authorization).toBe('Bearer jwt-1')
    expect(JSON.parse(opts.body)).toEqual({ action: 'cancel' })
    expect(r).toEqual({ ok: true, receivedAt: '2026-10-03T10:00:00Z' })
  })

  it('anonymously sends email and name with the anon key', async () => {
    const fetch = stub(res(200, { ok: true, receivedAt: 't' }))
    await cancelSubscription({ email: 'a@b.de', name: 'Anna' })
    const [, opts] = fetch.mock.calls[0]
    expect(opts.headers.Authorization).toBe(`Bearer ${anon}`)
    expect(JSON.parse(opts.body)).toEqual({ action: 'cancel', email: 'a@b.de', name: 'Anna' })
  })

  it('maps 429 to rate_limited and other failures to unknown', async () => {
    stub(res(429, { error: 'rate_limited' }))
    expect(await cancelSubscription({ email: 'a@b.de', name: 'A' })).toEqual({ ok: false, error: 'rate_limited' })
    stub(res(502, {}))
    expect(await cancelSubscription({ jwt: 'j' })).toEqual({ ok: false, error: 'unknown' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')))
    expect(await cancelSubscription({ jwt: 'j' })).toEqual({ ok: false, error: 'unknown' })
  })
})

describe('getMySubscription', () => {
  it('queries the newest live subscription and maps the row', async () => {
    const fetch = stub(res(200, [{
      id: 's1', plan_id: 'supporter', provider: 'creem', status: 'active',
      current_period_end: '2026-11-03T00:00:00Z', cancel_at_period_end: true,
      provider_customer_id: 'cus_1', customer_email: 'a@b.de', created_at: '2026-10-01T00:00:00Z',
    }]))

    const r = await getMySubscription('jwt-1')

    const [url, opts] = fetch.mock.calls[0]
    expect(url).toContain('/rest/v1/subscriptions?')
    expect(url).toContain('status=in.(active,trialing,past_due)')
    expect(url).toContain('order=created_at.desc')
    expect(url).toContain('limit=1')
    expect(opts.headers.Authorization).toBe('Bearer jwt-1')
    expect(r).toEqual({
      id: 's1', planId: 'supporter', provider: 'creem', status: 'active',
      currentPeriodEnd: '2026-11-03T00:00:00Z', cancelAtPeriodEnd: true,
      hasCustomer: true, customerEmail: 'a@b.de', createdAt: '2026-10-01T00:00:00Z',
    })
  })

  it('is null for no rows, a failed request or a network error', async () => {
    stub(res(200, []))
    expect(await getMySubscription('j')).toBeNull()
    stub(res(401, {}))
    expect(await getMySubscription('j')).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')))
    expect(await getMySubscription('j')).toBeNull()
  })
})

describe('getCheckoutEligibility', () => {
  it('calls the RPC and maps the row', async () => {
    const fetch = stub(res(200, [{ eligible: false, reason: 'grant_active', eligible_from: '2027-01-01T00:00:00Z' }]))
    const r = await getCheckoutEligibility('jwt-1')
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toContain('/rpc/get_my_checkout_eligibility')
    expect(opts.method).toBe('POST')
    expect(r).toEqual({ eligible: false, reason: 'grant_active', eligibleFrom: '2027-01-01T00:00:00Z' })
  })

  it('maps an eligible row', async () => {
    stub(res(200, [{ eligible: true, reason: null, eligible_from: null }]))
    expect(await getCheckoutEligibility('j')).toEqual({ eligible: true, reason: null, eligibleFrom: null })
  })

  it('fails closed on errors, empty bodies and network failure', async () => {
    const closed = { eligible: false, reason: 'unknown', eligibleFrom: null }
    stub(res(500, {}))
    expect(await getCheckoutEligibility('j')).toEqual(closed)
    stub(res(200, []))
    expect(await getCheckoutEligibility('j')).toEqual(closed)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')))
    expect(await getCheckoutEligibility('j')).toEqual(closed)
  })
})
