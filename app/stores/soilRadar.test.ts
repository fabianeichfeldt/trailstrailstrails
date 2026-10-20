import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive, ref } from 'vue'
import type { FeatureAccess } from '~/entitlements/features'
import type { SoilMapResponse } from '~/types/SoilMap'

// Only the network is mocked: store, gate and the soil-map adapter run for real.
let fetchMock = vi.fn()
function respond(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}
const answer = (data: SoilMapResponse) => fetchMock.mockResolvedValue(respond(200, data))
const access = ref<FeatureAccess>('allowed')
vi.stubGlobal('useSubscriptionStore', () => ({ accessFor: () => access.value }))
const CACHE_KEY = 'tr_soil_v2'

const getToken = vi.fn()
function makeAuth() {
  const a = reactive({ userId: 'u1', getToken, getUserId: async () => a.userId })
  return a
}
// Fresh per test so watchers of earlier tests' stores don't react to this test's sign-outs.
let auth = makeAuth()
vi.stubGlobal('useAuthStore', () => auth)

import { useSoilRadarStore } from './soilRadar'

const ENABLED_KEY = 'soil-radar-enabled'
const RANGE_KEY = 'soil-radar-range'

function snapshot(computedAt = new Date().toISOString()): SoilMapResponse {
  return {
    computedAt,
    spots: [
      { t: 'trail', id: 'a', lat: 47, lon: 11, lvl: 'prime', lo: 1, hi: 2 },
      { t: 'bikepark', id: 'b', lat: 47.1, lon: 11.1, lvl: 'wet', lo: 4, hi: 4 },
    ],
  }
}

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  access.value = 'allowed'
  getToken.mockReset().mockResolvedValue('tok')
  auth = makeAuth()
  setActivePinia(createPinia())
})

describe('soilRadar store — live', () => {
  it('starts disabled, idle, with the full range', () => {
    const s = useSoilRadarStore()
    expect(s.enabled).toBe(false)
    expect(s.status).toBe('idle')
    expect(s.mode).toBe('live')
    expect(s.range).toEqual({ lo: 0, hi: 4 })
    expect(s.points).toEqual([])
    expect(s.freshness).toBeNull()
  })

  it('toggle loads data with the user token, then enables', async () => {
    answer(snapshot())
    const s = useSoilRadarStore()
    await s.toggle()
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer tok')
    expect(s.enabled).toBe(true)
    expect(s.status).toBe('ready')
    expect(s.points).toHaveLength(2)
  })

  it('exposes status "loading" while the fetch is in flight', async () => {
    let resolve!: (v: unknown) => void
    fetchMock.mockReturnValue(new Promise(r => { resolve = r }))
    const s = useSoilRadarStore()
    const p = s.toggle()
    await nextTick()
    expect(s.status).toBe('loading')
    resolve(respond(200, snapshot()))
    await p
    expect(s.status).toBe('ready')
  })

  it('toggle again switches it off without refetching', async () => {
    answer(snapshot())
    const s = useSoilRadarStore()
    await s.toggle()
    await s.toggle()
    expect(s.enabled).toBe(false)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('stays disabled with status "error" and reports "unavailable" when nothing could be loaded', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    const s = useSoilRadarStore()
    await s.toggle()
    expect(s.enabled).toBe(false)
    expect(s.status).toBe('error')
    expect(s.failure).toBe('unavailable')
  })

  it('a 403 locks the radar, reports "locked" and leaves it off', async () => {
    fetchMock.mockResolvedValue(respond(403, {}))
    const s = useSoilRadarStore()
    await s.toggle()
    expect(s.access).toBe('locked')
    expect(s.failure).toBe('locked')
    expect(s.enabled).toBe(false)
  })

  it('says "checking" until something attaches it (prerendered HTML is the same for everyone)', () => {
    const s = useSoilRadarStore()
    expect(s.access).toBe('checking')
    s.attach()
    expect(s.access).toBe('allowed')
  })

  it('carries the offline flag through to freshness', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ uid: 'u1', at: 0, data: snapshot('2026-07-15T08:00:00.000Z') }))
    fetchMock.mockRejectedValue(new TypeError('offline'))
    const s = useSoilRadarStore()
    await s.toggle()
    expect(s.offline).toBe(true)
    expect(s.freshness).toEqual({ computedAt: '2026-07-15T08:00:00.000Z', stale: true, offline: true })
  })

  it('freshness is stale only beyond 24 h', async () => {
    answer(snapshot(new Date(Date.now() - 23 * 3600_000).toISOString()))
    const s = useSoilRadarStore()
    await s.toggle()
    expect(s.freshness?.stale).toBe(false)
  })

  it('verdictFor looks a spot up by type and id', async () => {
    answer(snapshot())
    const s = useSoilRadarStore()
    await s.toggle()
    expect(s.verdictFor('trail', 'a')).toBe('prime')
    expect(s.verdictFor('bikepark', 'b')).toBe('wet')
    expect(s.verdictFor('trail', 'b')).toBeUndefined()
  })
})

describe('soilRadar store — persistence', () => {
  it('persists enabled and range', async () => {
    answer(snapshot())
    const s = useSoilRadarStore()
    await s.toggle()
    s.setRange(1, 3)
    await nextTick()
    expect(localStorage.getItem(ENABLED_KEY)).toBe('1')
    expect(JSON.parse(localStorage.getItem(RANGE_KEY)!)).toEqual({ lo: 1, hi: 3 })

    setActivePinia(createPinia())
    const again = useSoilRadarStore()
    expect(again.enabled).toBe(true)
    expect(again.range).toEqual({ lo: 1, hi: 3 })
  })

  it('ignores a corrupt stored range', () => {
    localStorage.setItem(RANGE_KEY, '{oops')
    expect(useSoilRadarStore().range).toEqual({ lo: 0, hi: 4 })
  })

  it('falls back when storage throws', () => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = () => { throw new Error('blocked') }
    try {
      const s = useSoilRadarStore()
      expect(s.enabled).toBe(false)
      expect(s.range).toEqual({ lo: 0, hi: 4 })
    } finally {
      Storage.prototype.getItem = orig
    }
  })

  it('restore() loads data for a persisted-enabled radar once access is allowed', async () => {
    localStorage.setItem(ENABLED_KEY, '1')
    answer(snapshot())
    access.value = 'checking'
    const s = useSoilRadarStore()
    const done = s.restore()
    await nextTick()
    expect(fetchMock).not.toHaveBeenCalled()
    access.value = 'allowed'
    await done
    expect(s.points).toHaveLength(2)
    expect(s.enabled).toBe(true)
  })

  it('restore() switches a persisted "on" off without a request once access is locked', async () => {
    localStorage.setItem(ENABLED_KEY, '1')
    access.value = 'checking'
    const s = useSoilRadarStore()
    const done = s.restore()
    access.value = 'locked'
    await done
    expect(fetchMock).not.toHaveBeenCalled()
    expect(s.enabled).toBe(false)
    expect(s.failure).toBeNull()
    expect(localStorage.getItem(ENABLED_KEY)).toBe('0')
  })

  it('restore() reads the saved "on" itself — the prerendered payload hydrates enabled=false', async () => {
    localStorage.setItem(ENABLED_KEY, '1')
    answer(snapshot())
    const pinia = createPinia()
    pinia.state.value.soilRadar = {
      enabled: false, mode: 'live', data: null, range: { lo: 0, hi: 4 },
      sample: [],
    }
    setActivePinia(pinia)
    const s = useSoilRadarStore()
    expect(s.enabled).toBe(false)
    await s.restore()
    expect(s.enabled).toBe(true)
    expect(s.points).toHaveLength(2)
  })

  it('restore() brings back the saved range the prerendered payload reset, without overwriting it', async () => {
    localStorage.setItem(RANGE_KEY, JSON.stringify({ lo: 1, hi: 3 }))
    const pinia = createPinia()
    pinia.state.value.soilRadar = {
      enabled: false, mode: 'live', data: null, range: { lo: 0, hi: 4 },
      sample: [],
    }
    setActivePinia(pinia)
    const s = useSoilRadarStore()
    await nextTick()
    expect(JSON.parse(localStorage.getItem(RANGE_KEY)!)).toEqual({ lo: 1, hi: 3 })
    access.value = 'locked'
    await s.restore()
    expect(s.range).toEqual({ lo: 1, hi: 3 })
  })

  it('restore() drops a persisted-enabled radar the backend refuses', async () => {
    localStorage.setItem(ENABLED_KEY, '1')
    fetchMock.mockResolvedValue(respond(403, {}))
    const s = useSoilRadarStore()
    await s.restore()
    expect(s.enabled).toBe(false)
    expect(s.access).toBe('locked')
    expect(localStorage.getItem(ENABLED_KEY)).toBe('0')
    // Silent: a restore never reports a failure for the sheet or the notice.
    expect(s.failure).toBeNull()
  })
})

describe('soilRadar store — user change', () => {
  // The cache is swept app-wide: plugins/paidCacheSweep.client.test.ts.
  it('sign-out drops the live data and the "on" preference', async () => {
    answer(snapshot())
    const s = useSoilRadarStore()
    await s.toggle()
    auth.userId = ''
    await nextTick()
    expect(s.enabled).toBe(false)
    expect(s.data).toBeNull()
    expect(s.points).toEqual([])
    expect(s.status).toBe('idle')
    expect(localStorage.getItem(ENABLED_KEY)).toBe('0')
  })

  it('an answer that arrives after an account switch is dropped, not shown', async () => {
    let resolve!: (v: unknown) => void
    fetchMock.mockReturnValue(new Promise(r => { resolve = r }))
    const s = useSoilRadarStore()
    const p = s.toggle()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    auth.userId = 'u2'
    resolve(respond(200, snapshot()))
    await p
    expect(s.enabled).toBe(false)
    expect(s.data).toBeNull()
    expect(s.failure).toBeNull()
  })

  it('switching accounts resets as well', async () => {
    answer(snapshot())
    const s = useSoilRadarStore()
    await s.toggle()
    auth.userId = 'u2'
    await nextTick()
    expect(s.enabled).toBe(false)
    expect(s.data).toBeNull()
  })

  it('auth resolving on page load (no user → user) keeps a restored "on"', async () => {
    auth.userId = ''
    localStorage.setItem(ENABLED_KEY, '1')
    localStorage.setItem(CACHE_KEY, JSON.stringify({ uid: 'u1', at: Date.now(), data: snapshot() }))
    const s = useSoilRadarStore()
    auth.userId = 'u1'
    await nextTick()
    expect(s.enabled).toBe(true)
    expect(localStorage.getItem(CACHE_KEY)).not.toBeNull()
  })
})

describe('soilRadar store — range', () => {
  it('clamps to 0..4 and keeps lo <= hi', () => {
    const s = useSoilRadarStore()
    s.setRange(-1, 9)
    expect(s.range).toEqual({ lo: 0, hi: 4 })
    s.setRange(3, 1)
    expect(s.range).toEqual({ lo: 1, hi: 3 })
  })
})

describe('soilRadar store — sample', () => {
  const center = { lat: 47.3, lon: 11.4 }

  it('startSample enables a fake scene around the center without fetching or persisting', () => {
    const s = useSoilRadarStore()
    s.startSample(center)
    expect(s.mode).toBe('sample')
    expect(s.enabled).toBe(true)
    expect(s.points.length).toBeGreaterThanOrEqual(20)
    for (const p of s.points) {
      expect(Math.abs(p.lat - center.lat)).toBeLessThan(1)
      expect(Math.abs(p.lon - center.lon)).toBeLessThan(1.5)
    }
    expect(fetchMock).not.toHaveBeenCalled()
    expect(localStorage.getItem(ENABLED_KEY)).toBeNull()
  })

  it('is deterministic and mixes soil levels', () => {
    const s = useSoilRadarStore()
    s.startSample(center)
    const first = JSON.stringify(s.points)
    s.stopSample()
    s.startSample(center)
    expect(JSON.stringify(s.points)).toBe(first)
    expect(new Set(s.points.map(p => p.lvl)).size).toBeGreaterThanOrEqual(4)
  })

  it('has no freshness and no verdicts for real spots', () => {
    const s = useSoilRadarStore()
    s.startSample(center)
    expect(s.freshness).toBeNull()
    expect(s.verdictFor('trail', 'sample-0')).toBeUndefined()
  })

  it('stopSample returns to live, disabled', () => {
    const s = useSoilRadarStore()
    s.startSample(center)
    s.stopSample()
    expect(s.mode).toBe('live')
    expect(s.enabled).toBe(false)
    expect(s.points).toEqual([])
  })

  it('does not overwrite a persisted live preference', () => {
    localStorage.setItem(ENABLED_KEY, '1')
    const s = useSoilRadarStore()
    s.startSample(center)
    s.stopSample()
    expect(localStorage.getItem(ENABLED_KEY)).toBe('1')
  })
})
