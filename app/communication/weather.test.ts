import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { TrailConditionResponse } from '~/types/Weather'
import { FUNCTIONS } from './http'
import { fetchTrailCondition, TRAIL_CONDITION_CACHE_TTL_MS } from './weather'

// The network boundary is the only thing mocked: `fetch` is stubbed, so no test
// in this file reaches Supabase or the edge function.
function condition(overrides: Partial<TrailConditionResponse> = {}): TrailConditionResponse {
  return {
    verdict: { level: 'prime', headline: 'Hero Dirt', detail: 'Griffig und fest.', rain10dMm: 14.5 },
    rainRule: { raining: false, hoursSinceRain: 31 },
    current: { temperature: 12, apparentTemperature: 10, icon: '⛅', windKmh: 13 },
    strip: [
      { date: '2026-09-23', weekday: 'Mi', icon: '⛅', precipitationMm: 0, isToday: false, isForecast: false },
      { date: '2026-09-24', weekday: 'Do', icon: '⛅', precipitationMm: 0, isToday: true, isForecast: false },
    ],
    fetchedAt: '2026-09-24T10:00:00.000Z',
    ...overrides,
  }
}

function respond(status: number, body: unknown = condition()) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

const realFetch = globalThis.fetch
const KEY = 'tr_wx_v2_trail_t1'

beforeEach(() => localStorage.clear())
afterEach(() => {
  // Not vi.unstubAllGlobals(): it would also drop the ref/computed stubs from vitest.setup.ts.
  globalThis.fetch = realFetch
  vi.useRealTimers()
})

describe('fetchTrailCondition — request', () => {
  it('POSTs { spotType, spotId } to the trail-condition function with the user token, and no coordinates', async () => {
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)

    await fetchTrailCondition('trail', 't1', 'jwt-123')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${FUNCTIONS}/trail-condition`)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer jwt-123')
    expect(JSON.parse(init.body)).toEqual({ spotType: 'trail', spotId: 't1' })
  })
})

describe('fetchTrailCondition — responses', () => {
  it('returns the view-model on a 200', async () => {
    vi.stubGlobal('fetch', respond(200))
    expect(await fetchTrailCondition('trail', 't1', 'jwt')).toEqual(condition())
  })

  it.each([401, 403, 404, 502, 500])('returns null on a %i, never throws', async (status) => {
    vi.stubGlobal('fetch', respond(status, { error: 'nope' }))
    expect(await fetchTrailCondition('trail', 't1', 'jwt')).toBeNull()
  })

  it('returns null on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await fetchTrailCondition('trail', 't1', 'jwt')).toBeNull()
  })

  it('returns null on malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad') } }))
    expect(await fetchTrailCondition('trail', 't1', 'jwt')).toBeNull()
  })

  it('returns null when a 200 body is not a view-model', async () => {
    vi.stubGlobal('fetch', respond(200, { hello: 'world' }))
    expect(await fetchTrailCondition('trail', 't1', 'jwt')).toBeNull()
  })

  it('reports a 403 through onForbidden, and only a 403', async () => {
    const onForbidden = vi.fn()
    vi.stubGlobal('fetch', respond(403, {}))
    await fetchTrailCondition('trail', 't1', 'jwt', onForbidden)
    expect(onForbidden).toHaveBeenCalledTimes(1)

    vi.stubGlobal('fetch', respond(502, {}))
    await fetchTrailCondition('trail', 't1', 'jwt', onForbidden)
    expect(onForbidden).toHaveBeenCalledTimes(1)
  })
})

describe('fetchTrailCondition — per-device cache', () => {
  it('serves a fresh entry without calling the function', async () => {
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)

    await fetchTrailCondition('trail', 't1', 'jwt')
    const again = await fetchTrailCondition('trail', 't1', 'jwt')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(again).toEqual(condition())
    expect(localStorage.getItem(KEY)).not.toBeNull()
  })

  it('keys the cache per spot type and id', async () => {
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)

    await fetchTrailCondition('trail', 't1', 'jwt')
    await fetchTrailCondition('bikepark', 't1', 'jwt')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('refetches once the entry is older than the TTL', async () => {
    vi.useFakeTimers()
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)

    await fetchTrailCondition('trail', 't1', 'jwt')
    vi.advanceTimersByTime(TRAIL_CONDITION_CACHE_TTL_MS + 1000)
    await fetchTrailCondition('trail', 't1', 'jwt')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('drops a corrupt entry and refetches', async () => {
    localStorage.setItem(KEY, '{not json')
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchTrailCondition('trail', 't1', 'jwt')).toEqual(condition())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('clears the cached entry on a 403, so a downgraded user keeps no stale paid card', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', respond(200))
    await fetchTrailCondition('trail', 't1', 'jwt')
    expect(localStorage.getItem(KEY)).not.toBeNull()

    // Entry expires, function now refuses.
    vi.advanceTimersByTime(TRAIL_CONDITION_CACHE_TTL_MS + 1000)
    vi.stubGlobal('fetch', respond(403, {}))
    expect(await fetchTrailCondition('trail', 't1', 'jwt')).toBeNull()

    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('works without localStorage (prerender)', async () => {
    vi.stubGlobal('localStorage', undefined)
    vi.stubGlobal('fetch', respond(200))
    try {
      expect(await fetchTrailCondition('trail', 't1', 'jwt')).toEqual(condition())
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('works when localStorage throws', async () => {
    const boom = () => { throw new Error('denied') }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom })
    vi.stubGlobal('fetch', respond(200))
    try {
      expect(await fetchTrailCondition('trail', 't1', 'jwt')).toEqual(condition())
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
