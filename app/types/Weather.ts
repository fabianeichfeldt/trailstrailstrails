/**
 * Wire types for the Trail-Zustand feature. The weather itself and the model
 * that turns it into a verdict live in the `trail-condition` edge function
 * (trailradar-backend); the app only ever sees the finished view-model below.
 */

/**
 * What the spot's ground is probably like right now.
 *
 * `raining`/`snow` override the water balance; `hard` is the sealed-surface
 * case (asphalt pumptrack) where a soil verdict is meaningless; `unknown`
 * means the payload was incomplete and the UI should render nothing.
 */
export type ConditionLevel =
  | 'dusty'
  | 'prime'
  | 'damp'
  | 'wet'
  | 'raining'
  | 'snow'
  | 'hard'
  | 'unknown'

/**
 * What the `trail-condition` edge function returns: the finished verdict, not
 * the weather behind it. The model, its thresholds and the raw Open-Meteo data
 * stay server-side, so this is everything the card and the status banner get to
 * see. Kept identical to `_shared/types.ts` in trailradar-backend.
 */
export interface TrailConditionResponse {
  verdict: {
    level: ConditionLevel
    headline: string
    detail: string
    /** Measured rain over the last 10 days, in mm. */
    rain10dMm: number
  }
  /** Just enough for the status banner's rain-rule line. */
  rainRule: { raining: boolean; hoursSinceRain: number | null }
  current: { temperature: number; apparentTemperature: number; icon: string; windKmh: number }
  /** Only the displayed window: two past days, today, up to three ahead. */
  strip: Array<{
    date: string
    /** German two-letter label ("Mo"); the client shows "Heute" for `isToday`. */
    weekday: string
    icon: string
    precipitationMm: number
    isToday: boolean
    isForecast: boolean
  }>
  /** ISO timestamp. */
  fetchedAt: string
}
