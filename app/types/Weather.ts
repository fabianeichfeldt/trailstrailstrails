/**
 * Weather data for a spot, normalised from the Open-Meteo forecast API.
 *
 * Deliberately its own shape rather than Open-Meteo's raw JSON: the free tier
 * is non-commercial, so if trailradar.org ever monetises, the source has to be
 * swappable (Bright Sky / DWD is the fallback path). Everything above
 * communication/weather.ts talks in these types only.
 */

/** One calendar day at the spot, in the spot's own timezone. */
export interface DayWeather {
  /** ISO `yyyy-mm-dd`, local to the spot. */
  date: string
  weatherCode: number
  precipitationMm: number
  snowfallCm: number
  tempMax: number
  tempMin: number
  /** FAO reference evapotranspiration — how much water the day took back out. */
  et0Mm: number
}

export interface CurrentWeather {
  temperature: number
  apparentTemperature: number
  weatherCode: number
  precipitationMm: number
  windKmh: number
}

/** Parallel arrays, oldest first — same layout Open-Meteo returns. */
export interface HourlyWeather {
  /** Local-time stamps without offset, e.g. `2026-09-12T00:00`. */
  time: string[]
  precipitationMm: number[]
  snowfallCm: number[]
}

export interface SpotWeather {
  current: CurrentWeather
  /** Oldest → today. */
  days: DayWeather[]
  hourly: HourlyWeather
  /**
   * Needed to turn the offset-less local timestamps above into real UTC
   * instants — without it, `Date.parse('2026-09-12T00:00')` would silently be
   * read in the *browser's* timezone, not the spot's.
   */
  utcOffsetSeconds: number
  timezone: string
  elevation: number
}

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

export interface TrailCondition {
  level: ConditionLevel
  headline: string
  detail: string
  /** Accumulated water surplus over the balance window, in mm. */
  wetnessMm: number
  /** Hours since the last hour with measurable rain, or null if none in range. */
  hoursSinceRain: number | null
  /**
   * Rain that actually fell over the balance window (10 days), in mm. Measured
   * hours only — forecast rain is never included. Shown next to the verdict so
   * a rider can check the claim against something they can remember.
   */
  rain10dMm: number
}

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
