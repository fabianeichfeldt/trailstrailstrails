import { describe, expect, it } from 'vitest'
import {
  soilMatch, pinGhost, introDelayMs, clusterLevels, radarPoints, soilCountsInView, SOIL_INTRO_MS,
} from './markerPresentation'
import { FULL, soil, sample } from './markerPresentation.fixtures'

describe('soilMatch', () => {
  it('matches a level inside the range and ghosts one outside', () => {
    expect(soilMatch('prime', { lo: 1, hi: 3 })).toBe('match')
    expect(soilMatch('dusty', { lo: 1, hi: 3 })).toBe('ghost')
    expect(soilMatch('wet', { lo: 1, hi: 3 })).toBe('ghost')
  })

  it('is inclusive at both edges', () => {
    expect(soilMatch('dry', { lo: 1, hi: 3 })).toBe('match')
    expect(soilMatch('damp', { lo: 1, hi: 3 })).toBe('match')
  })

  it('treats raining as 3 and snow as 4', () => {
    expect(soilMatch('raining', { lo: 3, hi: 3 })).toBe('match')
    expect(soilMatch('raining', { lo: 0, hi: 2 })).toBe('ghost')
    expect(soilMatch('snow', { lo: 4, hi: 4 })).toBe('match')
    expect(soilMatch('snow', { lo: 0, hi: 3 })).toBe('ghost')
  })

  it('returns none for a missing, unknown or hard verdict, whatever the range', () => {
    expect(soilMatch(undefined, FULL)).toBe('none')
    expect(soilMatch('unknown', { lo: 1, hi: 2 })).toBe('none')
    expect(soilMatch('hard', FULL)).toBe('none')
  })

  it('works with float handle positions', () => {
    expect(soilMatch('prime', { lo: 2.2, hi: 4 })).toBe('ghost')
    expect(soilMatch('prime', { lo: 1.4, hi: 2.6 })).toBe('match')
  })
})

describe('pinGhost', () => {
  it('ghosts a verdict outside the range, never a pin without one', () => {
    expect(pinGhost('wet', { lo: 0, hi: 2 })).toBe(true)
    expect(pinGhost('prime', { lo: 0, hi: 2 })).toBe(false)
    expect(pinGhost(undefined, { lo: 1, hi: 2 })).toBe(false)
  })

  it('ghosts an unknown verdict as soon as the range is narrowed, at either end', () => {
    expect(pinGhost('unknown', FULL)).toBe(false)
    expect(pinGhost('unknown', { lo: 0, hi: 3 })).toBe(true)
    expect(pinGhost('unknown', { lo: 1, hi: 4 })).toBe(true)
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

describe('clusterLevels', () => {
  it('null (default cluster icon) while the radar is off', () => {
    expect(clusterLevels([{ level: 'dry' }], false)).toBeNull()
  })

  it('children without a verdict count as unknown', () => {
    expect(clusterLevels([{ level: 'dry' }, { level: undefined }, undefined], true)).toEqual(['dry', 'unknown', 'unknown'])
  })
})

describe('radarPoints / soilCountsInView', () => {
  const points = [sample('dusty', 48, 11), sample('wet', 48, 11), sample('unknown', 48, 11), sample('snow', 10, 11)]

  it('clouds only for matching spots', () => {
    const pts = radarPoints(soil({ points, range: { lo: 3, hi: 4 } }))
    expect(pts.map(p => [p.axis, p.frost])).toEqual([[4, false], [4, true]])
    expect(radarPoints(soil({ enabled: false, points }))).toEqual([])
  })

  it('counts in-view spots and how many match', () => {
    const view = { south: 40, north: 50, west: 0, east: 20 }
    expect(soilCountsInView(soil({ points, range: { lo: 0, hi: 1 } }), view)).toEqual({ matchCount: 1, totalCount: 3 })
    expect(soilCountsInView(soil({ enabled: false, points }), view)).toEqual({ matchCount: 0, totalCount: 0 })
    expect(soilCountsInView(soil(), view)).toEqual({ matchCount: 0, totalCount: 0 })
  })
})
