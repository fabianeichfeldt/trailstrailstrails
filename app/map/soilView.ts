import type { ConditionLevel } from '../types/Weather'

type SoilState = 'match' | 'ghost' | 'none'
type Range = { lo: number; hi: number }

/** Matches the layer's reveal sweep (soilRadarLayer SWEEP_MS), so badge pops follow the beam. */
export const SOIL_INTRO_MS = 1600

/** 'none' (no verdict) is only shown while nothing is filtered out; any narrower range ghosts it. */
export function soilMarkerState(state: SoilState, range: Range): 'visible' | 'ghost' {
  if (state === 'match') return 'visible'
  if (state === 'none') return range.lo <= 0 && range.hi >= 4 ? 'visible' : 'ghost'
  return 'ghost'
}

/** Pop delay of a badge = how far round the beam (north, clockwise) its spot is from the centre. */
export function introDelayMs(center: { lat: number; lon: number }, p: { lat: number; lon: number }): number {
  const dx = (p.lon - center.lon) * Math.cos(center.lat * Math.PI / 180)
  const dy = p.lat - center.lat
  const angle = Math.atan2(dx, dy) // 0 = north, clockwise positive
  const turns = (angle < 0 ? angle + 2 * Math.PI : angle) / (2 * Math.PI)
  return Math.round(turns * SOIL_INTRO_MS)
}

/** Spots in the viewport and how many of them pass the range filter. */
export function countSoilInView(
  spots: ReadonlyArray<{ lat: number; lon: number; lvl: ConditionLevel }>,
  bounds: { south: number; north: number; west: number; east: number },
  range: Range,
  stateOf: (level: ConditionLevel, range: Range) => SoilState,
): { matchCount: number; totalCount: number } {
  let matchCount = 0
  let totalCount = 0
  for (const s of spots) {
    if (s.lat < bounds.south || s.lat > bounds.north || s.lon < bounds.west || s.lon > bounds.east) continue
    totalCount++
    if (stateOf(s.lvl, range) === 'match') matchCount++
  }
  return { matchCount, totalCount }
}
