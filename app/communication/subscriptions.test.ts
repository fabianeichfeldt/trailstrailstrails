import { describe, it, expect, vi, afterEach } from 'vitest'
import { getMyEntitlement, FREE_ENTITLEMENT } from './subscriptions'

function ok(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

function err(status: number, body: unknown = { message: 'error' }) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('getMyEntitlement', () => {
  it('posts to the get_my_entitlement RPC with the bearer token', async () => {
    const fetch = vi.fn().mockReturnValue(ok([]))
    vi.stubGlobal('fetch', fetch)

    await getMyEntitlement('token-123')

    const [url, opts] = fetch.mock.calls[0]
    expect(url).toContain('/rpc/get_my_entitlement')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer token-123')
  })

  it('returns the mapped entitlement when a row comes back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([
      { plan_id: 'pro', level: 2, discount_percent: 20, early_adopter_free_until: '2027-03-23T00:00:00Z' },
    ])))

    const result = await getMyEntitlement('token-123')

    expect(result).toEqual({
      planId: 'pro',
      level: 2,
      discountPercent: 20,
      earlyAdopterFreeUntil: '2027-03-23T00:00:00Z',
    })
  })

  it('returns the free entitlement when the RPC returns no rows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([])))

    const result = await getMyEntitlement('token-123')

    expect(result).toEqual(FREE_ENTITLEMENT)
  })

  it('returns the free entitlement when the body is not a row list — the E2E catch-all answers every RPC with null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok(null)))

    await expect(getMyEntitlement('token-123')).resolves.toEqual(FREE_ENTITLEMENT)
  })

  it('returns the free entitlement when the network is down, instead of throwing into the caller', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(getMyEntitlement('token-123')).resolves.toEqual(FREE_ENTITLEMENT)
  })

  it('returns the free entitlement when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(401)))

    const result = await getMyEntitlement('token-123')

    expect(result).toEqual(FREE_ENTITLEMENT)
  })
})
