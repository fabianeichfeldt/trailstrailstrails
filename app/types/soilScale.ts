import type { ConditionLevel } from './Weather'

/** The ordered soil scale, dry end first; array index is the axis position. */
export const SOIL_SCALE = ['dusty', 'dry', 'prime', 'damp', 'wet'] as const
export type SoilScaleLevel = typeof SOIL_SCALE[number]

/** Upper end of the dusty(0)..wet(4) axis the radar slider, layer and badges use. */
export const SOIL_AXIS_MAX = SOIL_SCALE.length - 1

/** Levels that override the water balance; drawn on the map, but carry no range. */
export type SoilOverrideLevel = 'raining' | 'snow'
export type SoilLevel = SoilScaleLevel | SoilOverrideLevel

/** L1 "Earth" ramp, one colour per scale position. */
export const SOIL_PALETTE = ['#e0a526', '#8bbf3f', '#16c060', '#2ea8e6', '#6d4c41'] as const

/** The one label set for map chips, the radar legend and the spot page's condition scale. */
export const SOIL_LABELS: Record<SoilLevel, string> = {
  dusty: 'Staubig', dry: 'Trocken', prime: 'Hero Dirt', damp: 'Feucht',
  wet: 'Schlammig', raining: 'Regen', snow: 'Schnee',
}

// Map presentation only: raining reads as damp, snow as wet.
const OVERRIDE_AXIS: Record<SoilOverrideLevel, number> = { raining: 3, snow: 4 }

/** True for the five scale levels, i.e. a real soil verdict that carries a range. */
export function isSoilVerdict(level: ConditionLevel | undefined): level is SoilScaleLevel {
  return level !== undefined && (SOIL_SCALE as readonly string[]).includes(level)
}

/** True for every level the map draws a soil badge for (scale levels plus raining/snow). */
export function isSoilMapLevel(level: ConditionLevel | undefined): level is SoilLevel {
  return isSoilVerdict(level) || level === 'raining' || level === 'snow'
}

/** Axis position 0..4 of a map-drawable level; null for hard/unknown/undefined. */
export function soilAxis(level: ConditionLevel | undefined): number | null {
  if (isSoilVerdict(level)) return SOIL_SCALE.indexOf(level)
  return level === 'raining' || level === 'snow' ? OVERRIDE_AXIS[level] : null
}
