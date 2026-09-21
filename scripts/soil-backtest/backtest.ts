/**
 * Runs the app's real trail-condition model over 92 days of history and lines it
 * up with the weather model's own soil moisture — no copy of the model, so a
 * change to `app/utils/trailCondition.ts` shows up in the next backtest.
 *
 * Imports the app through the `~/` alias, so this only runs under vite-node
 * (`npm run backtest:soil`) or vitest, not under plain `node`.
 */
import { mapWeatherResponse } from '~/communication/weather'
import { computeTrailCondition, BALANCE_WINDOW_HOURS } from '~/utils/trailCondition'
import {
  analyseSpot,
  dailyMean,
  dailySum,
  normalisedMoistureByLevel,
  tallyLevels,
  usdaTexture,
  type AnalyseOptions,
  type Spot,
  type SpotSeries,
  type SpotStats,
} from './analysis'
import type { SoilProfile } from './sources'

export interface BacktestSeries {
  series: SpotSeries
  /** The model's verdict on each evaluated day, in the same order. */
  levels: string[]
}

const WINDOW_DAYS = BALANCE_WINDOW_HOURS / 24

const DAILY_FIELDS_NEEDED = [
  'precipitation_sum',
  'et0_fao_evapotranspiration',
  'snowfall_sum',
  'temperature_2m_max',
  'temperature_2m_min',
  'weather_code',
]
const HOURLY_FIELDS_NEEDED = ['precipitation', 'snowfall']

type Arrays = Record<string, unknown[]>

const isNumber = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v)

/**
 * Drops the days at the front of a payload — and everything before the last
 * incomplete day — so the rest has no missing rain, snow or et0.
 *
 * Found by the first live run: a `past_days=92` request comes back with the
 * first ~19 days empty. The trail model treats a single missing value anywhere
 * as "unusable" (better silent than wrong, in the app), so with those days
 * present every evaluated day came back "unknown". Cutting at the last hole
 * keeps the model strict and gives it a clean series.
 *
 * Returns a new object; the input is untouched.
 */
export function trimLeadingGaps(raw: unknown): unknown {
  const payload = raw as { daily?: Arrays; hourly?: Arrays }
  const daily = payload.daily
  const hourly = payload.hourly
  const dates = daily?.time as string[] | undefined
  const hours = hourly?.time as string[] | undefined
  if (!daily || !hourly || !dates || !hours) throw new Error('Open-Meteo payload has no daily/hourly time axes to trim')

  // A day is clean when every daily field is present and all 24 of its hourly rain/snow values are.
  const hourlyByDay = new Map<string, number[]>()
  hours.forEach((t, k) => {
    const day = t.slice(0, 10)
    hourlyByDay.set(day, [...(hourlyByDay.get(day) ?? []), k])
  })
  const dayClean = dates.map(
    (day, i) =>
      DAILY_FIELDS_NEEDED.every((f) => isNumber(daily[f]?.[i])) &&
      (hourlyByDay.get(day) ?? []).every((k) => HOURLY_FIELDS_NEEDED.every((f) => isNumber(hourly[f]?.[k]))),
  )
  const lastDirty = dayClean.lastIndexOf(false)
  const firstDay = lastDirty + 1
  if (firstDay >= dates.length) throw new Error('No complete days in the Open-Meteo payload')
  if (firstDay === 0) return raw

  const firstHour = hours.findIndex((t) => t.slice(0, 10) === dates[firstDay])
  const cut = (arrays: Arrays, from: number): Arrays =>
    Object.fromEntries(Object.entries(arrays).map(([key, values]) => [key, Array.isArray(values) ? values.slice(from) : values]))

  return { ...payload, daily: cut(daily, firstDay), hourly: cut(hourly, firstHour) }
}

/**
 * One model evaluation per day at 12:00 local time.
 *
 * - Leading empty days are trimmed first (see trimLeadingGaps).
 * - The first ten remaining days only feed the model's 10-day window, so
 *   evaluation starts on day ten, when the window is full.
 * - The last day is "today": partly forecast, so it is left out.
 * - Rain "right now" is zeroed. `computeTrailCondition` reads the live current
 *   conditions, which are the same for every historical day; left in, a drizzle
 *   at the moment of the download would turn the whole backtest into "raining".
 */
export function buildSpotSeries(rawPayload: unknown, layer: string): BacktestSeries {
  if (!mapWeatherResponse(rawPayload as Parameters<typeof mapWeatherResponse>[0])) {
    throw new Error('Open-Meteo payload is unusable for the trail model (missing current, daily or hourly fields)')
  }
  const raw = trimLeadingGaps(rawPayload)
  const weather = mapWeatherResponse(raw as Parameters<typeof mapWeatherResponse>[0])!
  if (weather.days.length < WINDOW_DAYS + 2) {
    throw new Error(`Not enough complete days after trimming gaps: ${weather.days.length}, need at least ${WINDOW_DAYS + 2}`)
  }

  const hourly = (raw as { hourly?: Record<string, (number | null)[] & string[]> }).hourly
  const layerValues = hourly?.[layer]
  if (!Array.isArray(layerValues)) throw new Error(`Open-Meteo payload has no "${layer}" series`)

  const neutral = { ...weather, current: { ...weather.current, precipitationMm: 0 } }
  const moistureByDay = dailyMean(weather.hourly.time, layerValues)
  const rainByDay = dailySum(weather.hourly.time, weather.hourly.precipitationMm)

  const dates: string[] = []
  const rainMm: number[] = []
  const moisture: number[] = []
  const bucketMm: number[] = []
  const levels: string[] = []

  // Rain history reaches back 92 days, but Open-Meteo's soil-moisture layers only
  // start later (2026-07-17 when this was written: 66 days). Days before the
  // layer begins are skipped; a hole AFTER it has begun is an error, because a
  // gap would silently corrupt every dry-down that spans it.
  let started = false
  for (let i = WINDOW_DAYS; i <= weather.days.length - 2; i++) {
    const date = weather.days[i]!.date
    const m = moistureByDay.get(date)
    if (m === undefined) {
      if (started) throw new Error(`No complete soil-moisture day for ${date} in layer "${layer}" — a gap inside the series`)
      continue
    }
    started = true
    const noonUtcMs = Date.parse(`${date}T12:00:00Z`) - weather.utcOffsetSeconds * 1000
    const condition = computeTrailCondition(neutral, 'soil', new Date(noonUtcMs))
    // "unknown" means the model refused the payload. Carrying on would fill the
    // bucket column with zeros and the report would look like a result — which
    // is exactly how the first live run went wrong.
    if (condition.level === 'unknown') {
      throw new Error(`The trail model answered "unknown" for ${date} — the payload still has missing values`)
    }

    dates.push(date)
    rainMm.push(rainByDay.get(date) ?? 0)
    moisture.push(m)
    // wetnessMm is signed: free water when positive, days of drying when negative.
    bucketMm.push(Math.max(0, condition.wetnessMm))
    levels.push(condition.level)
  }

  if (dates.length === 0) throw new Error(`No complete soil-moisture days in layer "${layer}" (the layer may not exist for this location)`)

  return { series: { dates, rainMm, moisture, bucketMm }, levels }
}

export interface SpotRow {
  spot: Spot
  /** First and last evaluated day — what the numbers actually rest on. */
  period: { from: string; to: string }
  soil: SoilProfile | null
  texture: string | null
  /** Median moisture as a share of the way from wilting point (0) to field capacity (1). */
  relSaturation: number | null
  pctDaysAboveFieldCapacity: number | null
  levels: Record<string, number>
  /** Median position of each verdict inside this spot's own moisture range (0 = driest days, 1 = highest). */
  moistureByLevel: Record<string, number>
  stats: SpotStats
}

export function buildSpotRow(
  spot: Spot,
  soil: SoilProfile | null,
  result: BacktestSeries,
  analyse: AnalyseOptions = {},
): SpotRow {
  const stats = analyseSpot(result.series, analyse)
  const { moisture } = result.series

  let relSaturation: number | null = null
  let pctDaysAboveFieldCapacity: number | null = null
  if (soil && soil.wv0033 > soil.wv1500) {
    relSaturation = (stats.moistureP50 - soil.wv1500) / (soil.wv0033 - soil.wv1500)
    pctDaysAboveFieldCapacity = (moisture.filter((m) => m > soil.wv0033).length / moisture.length) * 100
  }

  return {
    spot,
    period: { from: result.series.dates[0]!, to: result.series.dates.at(-1)! },
    soil,
    texture: soil ? usdaTexture(soil) : null,
    relSaturation,
    pctDaysAboveFieldCapacity,
    levels: tallyLevels(result.levels),
    moistureByLevel: normalisedMoistureByLevel(result.levels, moisture),
    stats,
  }
}
