import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive, ref } from 'vue'
import type { FeatureAccess } from '~/entitlements/features'
import type { SoilMapResponse } from '~/types/SoilMap'

// Boundary mocked: the fetch layer itself is covered by soilMap.test.ts.
const fetchSoilMap = vi.fn()
const clearSoilCache = vi.fn()
vi.mock('~/communication/soilMap', () => ({
  fetchSoilMap: (...a: unknown[]) => fetchSoilMap(...a),
  clearSoilCache: () => clearSoilCache(),
}))

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
  fetchSoilMap.mockReset()
  clearSoilCache.mockReset()
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
    fetchSoilMap.mockResolvedValue({ data: snapshot(), offline: false })
    const s = useSoilRadarStore()
    await s.toggle()
    expect(fetchSoilMap).toHaveBeenCalledWith('tok', 'u1', expect.any(Function))
    expect(s.enabled).toBe(true)
    expect(s.status).toBe('ready')
    expect(s.points).toHaveLength(2)
  })

  it('exposes status "loading" while the fetch is in flight', async () => {
    let resolve!: (v: unknown) => void
    fetchSoilMap.mockReturnValue(new Promise(r => { resolve = r }))
    const s = useSoilRadarStore()
    const p = s.toggle()
    await nextTick()
    expect(s.status).toBe('loading')
    resolve({ data: snapshot(), offline: false })
    await p
    expect(s.status).toBe('ready')
  })

  it('toggle again switches it off without refetching', async () => {
    fetchSoilMap.mockResolvedValue({ data: snapshot(), offline: false })
    const s = useSoilRadarStore()
    await s.toggle()
    await s.toggle()
    expect(s.enabled).toBe(false)
    expect(fetchSoilMap).toHaveBeenCalledOnce()
  })

  it('stays disabled with status "error" when nothing could be loaded', async () => {
    fetchSoilMap.mockResolvedValue(null)
    const s = useSoilRadarStore()
    await s.toggle()
    expect(s.enabled).toBe(false)
    expect(s.status).toBe('error')
  })

  it('a 403 sets forbidden and leaves the radar off', async () => {
    fetchSoilMap.mockImplementation(async (_t: string, _u: string, onForbidden: () => void) => { onForbidden(); return null })
    const s = useSoilRadarStore()
    await s.toggle()
    expect(s.forbidden).toBe(true)
    expect(s.enabled).toBe(false)
  })

  it('carries the offline flag through to freshness', async () => {
    fetchSoilMap.mockResolvedValue({ data: snapshot('2026-07-15T08:00:00.000Z'), offline: true })
    const s = useSoilRadarStore()
    await s.toggle()
    expect(s.offline).toBe(true)
    expect(s.freshness).toEqual({ computedAt: '2026-07-15T08:00:00.000Z', stale: true, offline: true })
  })

  it('freshness is stale only beyond 24 h', async () => {
    fetchSoilMap.mockResolvedValue({ data: snapshot(new Date(Date.now() - 23 * 3600_000).toISOString()), offline: false })
    const s = useSoilRadarStore()
    await s.toggle()
    expect(s.freshness?.stale).toBe(false)
  })

  it('verdictFor looks a spot up by type and id', async () => {
    fetchSoilMap.mockResolvedValue({ data: snapshot(), offline: false })
    const s = useSoilRadarStore()
    await s.toggle()
    expect(s.verdictFor('trail', 'a')).toBe('prime')
    expect(s.verdictFor('bikepark', 'b')).toBe('wet')
    expect(s.verdictFor('trail', 'b')).toBeUndefined()
  })
})

describe('soilRadar store — persistence', () => {
  it('persists enabled and range', async () => {
    fetchSoilMap.mockResolvedValue({ data: snapshot(), offline: false })
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
    fetchSoilMap.mockResolvedValue({ data: snapshot(), offline: false })
    const access = ref<FeatureAccess>('checking')
    const s = useSoilRadarStore()
    const done = s.restore(access)
    await nextTick()
    expect(fetchSoilMap).not.toHaveBeenCalled()
    access.value = 'allowed'
    await done
    expect(s.points).toHaveLength(2)
    expect(s.enabled).toBe(true)
  })

  it('restore() switches a persisted "on" off without a request once access is locked', async () => {
    localStorage.setItem(ENABLED_KEY, '1')
    const access = ref<FeatureAccess>('checking')
    const s = useSoilRadarStore()
    const done = s.restore(access)
    access.value = 'locked'
    await done
    expect(fetchSoilMap).not.toHaveBeenCalled()
    expect(s.enabled).toBe(false)
    expect(s.forbidden).toBe(false)
    expect(localStorage.getItem(ENABLED_KEY)).toBe('0')
  })

  it('restore() reads the saved "on" itself — the prerendered payload hydrates enabled=false', async () => {
    localStorage.setItem(ENABLED_KEY, '1')
    fetchSoilMap.mockResolvedValue({ data: snapshot(), offline: false })
    const pinia = createPinia()
    pinia.state.value.soilRadar = {
      enabled: false, mode: 'live', data: null, range: { lo: 0, hi: 4 },
      status: 'idle', offline: false, forbidden: false, sample: [],
    }
    setActivePinia(pinia)
    const s = useSoilRadarStore()
    expect(s.enabled).toBe(false)
    await s.restore(ref<FeatureAccess>('allowed'))
    expect(s.enabled).toBe(true)
    expect(s.points).toHaveLength(2)
  })

  it('restore() brings back the saved range the prerendered payload reset, without overwriting it', async () => {
    localStorage.setItem(RANGE_KEY, JSON.stringify({ lo: 1, hi: 3 }))
    const pinia = createPinia()
    pinia.state.value.soilRadar = {
      enabled: false, mode: 'live', data: null, range: { lo: 0, hi: 4 },
      status: 'idle', offline: false, forbidden: false, sample: [],
    }
    setActivePinia(pinia)
    const s = useSoilRadarStore()
    await nextTick()
    expect(JSON.parse(localStorage.getItem(RANGE_KEY)!)).toEqual({ lo: 1, hi: 3 })
    await s.restore(ref<FeatureAccess>('locked'))
    expect(s.range).toEqual({ lo: 1, hi: 3 })
  })

  it('restore() drops a persisted-enabled radar the backend refuses', async () => {
    localStorage.setItem(ENABLED_KEY, '1')
    fetchSoilMap.mockImplementation(async (_t: string, _u: string, onForbidden: () => void) => { onForbidden(); return null })
    const s = useSoilRadarStore()
    await s.restore(ref<FeatureAccess>('allowed'))
    expect(s.enabled).toBe(false)
    expect(s.forbidden).toBe(true)
  })
})

describe('soilRadar store — user change', () => {
  it('sign-out drops the live data, the "on" preference and the cache', async () => {
    fetchSoilMap.mockResolvedValue({ data: snapshot(), offline: false })
    const s = useSoilRadarStore()
    await s.toggle()
    auth.userId = ''
    await nextTick()
    expect(s.enabled).toBe(false)
    expect(s.data).toBeNull()
    expect(s.points).toEqual([])
    expect(s.status).toBe('idle')
    expect(localStorage.getItem(ENABLED_KEY)).toBe('0')
    expect(clearSoilCache).toHaveBeenCalled()
  })

  it('switching accounts resets as well', async () => {
    fetchSoilMap.mockResolvedValue({ data: snapshot(), offline: false })
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
    const s = useSoilRadarStore()
    auth.userId = 'u1'
    await nextTick()
    expect(s.enabled).toBe(true)
    expect(clearSoilCache).not.toHaveBeenCalled()
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
    expect(fetchSoilMap).not.toHaveBeenCalled()
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
