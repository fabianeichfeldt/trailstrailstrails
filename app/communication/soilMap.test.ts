import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { SoilMapResponse } from '~/types/SoilMap'
import { createGatedFetch } from '~/entitlements/gatedFetch'
import { FUNCTIONS } from './http'
import { soilMapAdapter } from './soilMap'

// Only `fetch` is stubbed: the adapter runs inside the real gate, so its freshness
// and offline rules are tested the way the store uses them.
async function fetchSoil(uid: string) {
  const gate = createGatedFetch(soilMapAdapter, {
    access: () => 'allowed', userId: () => uid, getUserId: async () => uid, getToken: async () => 'tok',
  })
  gate.markMounted()
  await gate.load()
  return gate.data.value ? { data: gate.data.value, offline: gate.offline.value, state: gate.state.value } : null
}
// The backend says when its next refresh is; the client has no schedule of its own.
function snapshot(computedAt = '2026-07-15T08:00:00.000Z', nextRunAt: string | undefined = '2026-07-15T10:00:00.000Z'): SoilMapResponse {
  return { computedAt, nextRunAt, spots: [{ t: 'trail', id: 'a', lat: 47, lon: 11, lvl: 'prime', lo: 1, hi: 2 }] }
}

function respond(status: number, body: unknown = snapshot()) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

const realFetch = globalThis.fetch
const KEY = 'tr_soil_v2'
const CACHED_AT = Date.parse('2026-07-15T08:05:00Z')
// snapshot().nextRunAt is 10:00Z; the entry stays valid 10 min longer (grace for the job)
const BEFORE_EXPIRY = new Date('2026-07-15T10:09:00Z')
const AFTER_EXPIRY = new Date('2026-07-15T10:11:00Z')

beforeEach(() => localStorage.clear())
afterEach(() => {
  globalThis.fetch = realFetch
  vi.useRealTimers()
})

describe('soil-map adapter — request', () => {
  it('POSTs to soil-map with the user token', async () => {
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)
    await fetchSoil('u1')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${FUNCTIONS}/soil-map`)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it('returns the data, not offline, and caches it with the fetch time', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(CACHED_AT)
    vi.stubGlobal('fetch', respond(200))
    const r = await fetchSoil('u1')
    expect(r).toEqual({ data: snapshot(), offline: false, state: 'ready' })
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ uid: 'u1', at: CACHED_AT, data: snapshot() })
  })
})

describe('soil-map adapter — cache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.setItem(KEY, JSON.stringify({ uid: 'u1', at: CACHED_AT, data: snapshot() }))
  })

  it('serves a cache entry without fetching until the backend\'s nextRunAt plus 10 minutes', async () => {
    vi.setSystemTime(BEFORE_EXPIRY)
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchSoil('u1')).toEqual({ data: snapshot(), offline: false, state: 'ready' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refetches once the entry has expired', async () => {
    vi.setSystemTime(AFTER_EXPIRY)
    const fresh = snapshot('2026-07-15T10:02:00.000Z')
    const fetchMock = respond(200, fresh)
    vi.stubGlobal('fetch', fetchMock)
    expect((await fetchSoil('u1'))?.data).toEqual(fresh)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('without nextRunAt (older backend) the entry is valid for one hour after the fetch', async () => {
    const { nextRunAt: _, ...older } = snapshot()
    localStorage.setItem(KEY, JSON.stringify({ uid: 'u1', at: CACHED_AT, data: older }))
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)
    vi.setSystemTime(CACHED_AT + 59 * 60_000)
    await fetchSoil('u1')
    expect(fetchMock).not.toHaveBeenCalled()
    vi.setSystemTime(CACHED_AT + 61 * 60_000)
    await fetchSoil('u1')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('falls back to the stale entry, flagged offline, when the network fails', async () => {
    vi.setSystemTime(AFTER_EXPIRY)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await fetchSoil('u1')).toEqual({ data: snapshot(), offline: true, state: 'ready' })
  })

  it('falls back to the stale entry on a 500 as well', async () => {
    vi.setSystemTime(AFTER_EXPIRY)
    vi.stubGlobal('fetch', respond(500, { error: 'failed' }))
    expect((await fetchSoil('u1'))?.offline).toBe(true)
  })

  it('403 clears the cache and leaves no data', async () => {
    vi.setSystemTime(AFTER_EXPIRY)
    vi.stubGlobal('fetch', respond(403, { error: 'forbidden' }))
    expect(await fetchSoil('u1')).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('drops a corrupt entry and fetches', async () => {
    vi.setSystemTime(BEFORE_EXPIRY)
    localStorage.setItem(KEY, '{not json')
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)
    expect((await fetchSoil('u1'))?.data).toEqual(snapshot())
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

describe('soil-map adapter — cache is per user', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.setItem(KEY, JSON.stringify({ uid: 'u1', at: CACHED_AT, data: snapshot() }))
  })

  it('never serves another user\'s fresh entry, and drops it', async () => {
    vi.setSystemTime(BEFORE_EXPIRY)
    const fetchMock = respond(403, { error: 'forbidden' })
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchSoil('u2')).toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('never falls back to another user\'s entry when offline', async () => {
    vi.setSystemTime(AFTER_EXPIRY)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await fetchSoil('u2')).toBeNull()
  })

  it('ignores a legacy entry without a user id', async () => {
    vi.setSystemTime(BEFORE_EXPIRY)
    localStorage.setItem(KEY, JSON.stringify({ at: CACHED_AT, data: snapshot() }))
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)
    await fetchSoil('u1')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('without a user id it neither reads nor writes the cache', async () => {
    vi.setSystemTime(BEFORE_EXPIRY)
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)
    await fetchSoil('')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(JSON.parse(localStorage.getItem(KEY)!).uid).toBe('u1')
  })
})

describe('soil-map adapter — failures never throw', () => {
  it('returns null on network error without cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    expect(await fetchSoil('u1')).toBeNull()
  })

  it('returns null on a malformed body', async () => {
    vi.stubGlobal('fetch', respond(200, { nope: true }))
    expect(await fetchSoil('u1')).toBeNull()
  })

  it('returns null on 401', async () => {
    vi.stubGlobal('fetch', respond(401, { error: 'unauthorized' }))
    expect(await fetchSoil('u1')).toBeNull()
  })
})
