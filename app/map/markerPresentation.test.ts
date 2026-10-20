import { describe, expect, it } from 'vitest'
import type { SoilMapSpot } from '../types/SoilMap'
import type { ConditionLevel } from '../types/Weather'
import {
  soilMatch, pinGhost, clusterLevels, radarPoints, soilCountsInView,
  type SoilInput,
} from './markerPresentation'

const FULL = { lo: 0, hi: 4 }
const WORLD = { south: -90, north: 90, west: -180, east: 180 }

function soil(over: Partial<SoilInput> & { verdicts?: Record<string, ConditionLevel> } = {}): SoilInput {
  const { verdicts = {}, ...rest } = over
  return {
    enabled: true, mode: 'live', range: FULL, points: [],
    verdictFor: (t, id) => verdicts[`${t}:${id}`],
    ...rest,
  }
}

const sample = (lvl: ConditionLevel, lat = 48, lon = 11): SoilMapSpot =>
  ({ t: 'trail', id: `s-${lvl}`, lat, lon, lvl, lo: null, hi: null })

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

  it('ghosts an unknown verdict as soon as the range is narrowed', () => {
    expect(pinGhost('unknown', FULL)).toBe(false)
    expect(pinGhost('unknown', { lo: 0, hi: 3 })).toBe(true)
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
  })
})
