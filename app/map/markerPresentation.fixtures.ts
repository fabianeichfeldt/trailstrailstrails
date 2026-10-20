import type { SoilMapSpot } from '../types/SoilMap'
import type { ConditionLevel } from '../types/Weather'
import type { SoilInput } from './markerPresentation'

// Test-only builders shared by the markerPresentation unit tests and the filter × soil tests.

export const FULL = { lo: 0, hi: 4 }
export const WORLD = { south: -90, north: 90, west: -180, east: 180 }

/** Live radar over the full range; `verdicts` keyed `type:id`. */
export function soil(over: Partial<SoilInput> & { verdicts?: Record<string, ConditionLevel> } = {}): SoilInput {
  const { verdicts = {}, ...rest } = over
  return {
    enabled: true, mode: 'live', range: FULL, points: [],
    verdictFor: (t, id) => verdicts[`${t}:${id}`],
    ...rest,
  }
}

export const sample = (lvl: ConditionLevel, lat = 48, lon = 11): SoilMapSpot =>
  ({ t: 'trail', id: `s-${lvl}`, lat, lon, lvl, lo: null, hi: null })
