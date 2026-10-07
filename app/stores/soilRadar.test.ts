import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { SoilMapResponse } from '~/types/SoilMap'

// Boundary mocked: the fetch layer itself is covered by soilMap.test.ts.
const fetchSoilMap = vi.fn()
vi.mock('~/communication/soilMap', () => ({ fetchSoilMap: (...a: unknown[]) => fetchSoilMap(...a) }))

const getToken = vi.fn()
vi.stubGlobal('useAuthStore', () => ({ getToken }))

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
  getToken.mockReset().mockResolvedValue('tok')
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
    expect(fetchSoilMap).toHaveBeenCalledWith('tok', expect.any(Function))
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
    fetchSoilMap.mockImplementation(async (_t: string, onForbidden: () => void) => { onForbidden(); return null })
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

  it('load() restores data for a persisted-enabled radar', async () => {
    localStorage.setItem(ENABLED_KEY, '1')
    fetchSoilMap.mockResolvedValue({ data: snapshot(), offline: false })
    const s = useSoilRadarStore()
    await s.load()
    expect(s.points).toHaveLength(2)
    expect(s.enabled).toBe(true)
  })

  it('load() drops a persisted-enabled radar that is no longer allowed', async () => {
    localStorage.setItem(ENABLED_KEY, '1')
    fetchSoilMap.mockImplementation(async (_t: string, onForbidden: () => void) => { onForbidden(); return null })
    const s = useSoilRadarStore()
    await s.load()
    expect(s.enabled).toBe(false)
    expect(s.forbidden).toBe(true)
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
