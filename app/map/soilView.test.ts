import { describe, it, expect } from 'vitest'
import { soilMarkerState, introDelayMs, countSoilInView, SOIL_INTRO_MS } from './soilView'

const FULL = { lo: 0, hi: 4 }

describe('soilMarkerState', () => {
  it('match is visible, ghost is ghosted', () => {
    expect(soilMarkerState('match', FULL)).toBe('visible')
    expect(soilMarkerState('ghost', { lo: 1, hi: 2 })).toBe('ghost')
  })

  it('spots without a verdict stay visible only for the full range', () => {
    expect(soilMarkerState('none', FULL)).toBe('visible')
    expect(soilMarkerState('none', { lo: 0, hi: 3 })).toBe('ghost')
    expect(soilMarkerState('none', { lo: 1, hi: 4 })).toBe('ghost')
  })
})

describe('introDelayMs', () => {
  const c = { lat: 48, lon: 11 }
  it('starts at north and sweeps clockwise', () => {
    expect(introDelayMs(c, { lat: 49, lon: 11 })).toBe(0)
    expect(introDelayMs(c, { lat: 48, lon: 12 })).toBeCloseTo(SOIL_INTRO_MS * 0.25, -1)
    expect(introDelayMs(c, { lat: 47, lon: 11 })).toBeCloseTo(SOIL_INTRO_MS * 0.5, -1)
    expect(introDelayMs(c, { lat: 48, lon: 10 })).toBeCloseTo(SOIL_INTRO_MS * 0.75, -1)
  })

  it('is never negative and stays within one sweep', () => {
    for (const p of [{ lat: 48.5, lon: 10.2 }, { lat: 47.2, lon: 12.9 }, { lat: 48, lon: 11 }]) {
      const d = introDelayMs(c, p)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(SOIL_INTRO_MS)
    }
  })
})

describe('countSoilInView', () => {
  const bounds = { south: 47, north: 49, west: 10, east: 12 }
  const spots = [
    { lat: 48, lon: 11, lvl: 'prime' as const },
    { lat: 48.5, lon: 11.5, lvl: 'wet' as const },
    { lat: 60, lon: 11, lvl: 'prime' as const }, // out of view
    { lat: 48, lon: 11.2, lvl: 'unknown' as const },
  ]
  const stateOf = (lvl: string, r: { lo: number; hi: number }) =>
    lvl === 'prime' ? 'match' as const : lvl === 'wet' ? (r.hi >= 4 ? 'match' as const : 'ghost' as const) : 'none' as const

  it('counts only spots in the viewport; matches only where state is match', () => {
    expect(countSoilInView(spots, bounds, FULL, stateOf)).toEqual({ matchCount: 2, totalCount: 3 })
    expect(countSoilInView(spots, bounds, { lo: 0, hi: 2 }, stateOf)).toEqual({ matchCount: 1, totalCount: 3 })
  })

  it('handles an empty list', () => {
    expect(countSoilInView([], bounds, FULL, stateOf)).toEqual({ matchCount: 0, totalCount: 0 })
  })
})
