import { describe, it, expect, vi, afterEach } from 'vitest'
import { getSupporterPrices } from './plans'

const BASE_URL = 'https://test.supabase.co'

afterEach(() => vi.unstubAllGlobals())

describe('getSupporterPrices', () => {
  it('reads the supporter plan from subscription_plans with anon headers', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { price_monthly_cents: 300, price_yearly_cents: 2500, currency: 'EUR' },
    ]), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await expect(getSupporterPrices()).resolves.toEqual({ monthlyCents: 300, yearlyCents: 2500, currency: 'EUR' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`${BASE_URL}/rest/v1/subscription_plans?id=eq.supporter&select=price_monthly_cents,price_yearly_cents,currency`)
    expect(init.headers.apikey).toBeTruthy()
  })

  it('is null when the row is missing, the request fails or the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })))
    await expect(getSupporterPrices()).resolves.toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 500 })))
    await expect(getSupporterPrices()).resolves.toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(getSupporterPrices()).resolves.toBeNull()
  })
})
