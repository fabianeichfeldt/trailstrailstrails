import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { SoilMapResponse } from '~/types/SoilMap'
import { FUNCTIONS } from './http'
import { fetchSoilMap } from './soilMap'

// Only `fetch` is stubbed: nothing here reaches Supabase.
function snapshot(computedAt = '2026-07-15T08:00:00.000Z'): SoilMapResponse {
  return { computedAt, spots: [{ t: 'trail', id: 'a', lat: 47, lon: 11, lvl: 'prime', lo: 1, hi: 2 }] }
}

function respond(status: number, body: unknown = snapshot()) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

const realFetch = globalThis.fetch
const KEY = 'tr_soil_v1'
// snapshot() is computed 10:00 CEST -> next run 12:00 CEST (10:00Z), +10 min grace
const BEFORE_EXPIRY = new Date('2026-07-15T10:09:00Z')
const AFTER_EXPIRY = new Date('2026-07-15T10:11:00Z')

beforeEach(() => localStorage.clear())
afterEach(() => {
  globalThis.fetch = realFetch
  vi.useRealTimers()
})

describe('fetchSoilMap — request', () => {
  it('POSTs to soil-map with the user token', async () => {
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)
    await fetchSoilMap('tok')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${FUNCTIONS}/soil-map`)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it('returns the data, not offline, and caches it', async () => {
    vi.stubGlobal('fetch', respond(200))
    const r = await fetchSoilMap('tok')
    expect(r).toEqual({ data: snapshot(), offline: false })
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ computedAt: snapshot().computedAt, data: snapshot() })
  })
})

describe('fetchSoilMap — cache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.setItem(KEY, JSON.stringify({ computedAt: snapshot().computedAt, data: snapshot() }))
  })

  it('serves a cache entry without fetching until the next run plus 10 minutes', async () => {
    vi.setSystemTime(BEFORE_EXPIRY)
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchSoilMap('tok')).toEqual({ data: snapshot(), offline: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refetches once the entry has expired', async () => {
    vi.setSystemTime(AFTER_EXPIRY)
    const fresh = snapshot('2026-07-15T10:02:00.000Z')
    const fetchMock = respond(200, fresh)
    vi.stubGlobal('fetch', fetchMock)
    expect((await fetchSoilMap('tok'))?.data).toEqual(fresh)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('falls back to the stale entry, flagged offline, when the network fails', async () => {
    vi.setSystemTime(AFTER_EXPIRY)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await fetchSoilMap('tok')).toEqual({ data: snapshot(), offline: true })
  })

  it('falls back to the stale entry on a 500 as well', async () => {
    vi.setSystemTime(AFTER_EXPIRY)
    vi.stubGlobal('fetch', respond(500, { error: 'failed' }))
    expect((await fetchSoilMap('tok'))?.offline).toBe(true)
  })

  it('403 clears the cache, calls onForbidden and returns null', async () => {
    vi.setSystemTime(AFTER_EXPIRY)
    vi.stubGlobal('fetch', respond(403, { error: 'forbidden' }))
    const onForbidden = vi.fn()
    expect(await fetchSoilMap('tok', onForbidden)).toBeNull()
    expect(onForbidden).toHaveBeenCalledOnce()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('drops a corrupt entry and fetches', async () => {
    vi.setSystemTime(BEFORE_EXPIRY)
    localStorage.setItem(KEY, '{not json')
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)
    expect((await fetchSoilMap('tok'))?.data).toEqual(snapshot())
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe('fetchSoilMap — failures never throw', () => {
  it('returns null on network error without cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await fetchSoilMap('tok')).toBeNull()
  })

  it('returns null on a malformed body', async () => {
    vi.stubGlobal('fetch', respond(200, { nope: true }))
    expect(await fetchSoilMap('tok')).toBeNull()
  })

  it('returns null on 401', async () => {
    vi.stubGlobal('fetch', respond(401, { error: 'unauthorized' }))
    expect(await fetchSoilMap('tok')).toBeNull()
  })
})
