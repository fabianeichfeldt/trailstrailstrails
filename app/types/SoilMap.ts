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

/** Snow is drawn as frost rather than as a wet soil colour. */
export function isFrost(level: ConditionLevel | undefined): boolean {
  return level === 'snow'
}
