import type { ConditionLevel } from './Weather'

/** Wire format of the `soil-map` edge function (trailradar-backend). */
export interface SoilMapSpot {
  t: 'trail' | 'bikepark' | 'dirtpark'
  id: string
  lat: number
  lon: number
  lvl: ConditionLevel
  lo: number | null
  hi: number | null
}

export interface SoilMapResponse {
  /** ISO instant: newest computed_at in the snapshot. */
  computedAt: string
  /** ISO instant of the backend's next scheduled refresh; the client caches until then. */
  nextRunAt?: string
  spots: SoilMapSpot[]
}

/** Upper end of the dusty(0)..wet(4) axis the radar slider and layer use. */
export const SOIL_AXIS_MAX = 4

const AXIS: Record<ConditionLevel, number | null> = {
  dusty: 0, dry: 1, prime: 2, damp: 3, wet: 4,
  raining: 3, snow: 4,
  hard: null, unknown: null, // no soil verdict: not on the axis
}

export function levelToAxis(level: ConditionLevel | undefined): number | null {
  return level === undefined ? null : AXIS[level] ?? null
}

/** Snow is drawn as frost rather than as a wet soil colour. */
export function isFrost(level: ConditionLevel | undefined): boolean {
  return level === 'snow'
}
