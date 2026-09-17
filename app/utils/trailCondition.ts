import type { SpotWeather, TrailCondition, ConditionLevel } from '~/types/Weather'
import { type Trail, isDirtPark } from '~/types/Trail'
import { weatherCodeLabel } from './weatherCodes'

/**
 * Turns a spot's recent weather into a statement about how the ground is
 * probably riding right now.
 *
 * Pure on purpose — no fetch, no Date.now() except through the injectable
 * `now` argument, no imports from communication/, stores/ or composables/.
 * That keeps it deterministically testable, and leaves it reusable from a
 * server-side pre-computation (pg_cron cache) if that ever gets built.
 *
 * The core idea: a bare "mm in the last 72h" figure is seasonally misleading.
 * 13mm in July is gone in two days; the same 13mm in November is not. So we
 * run a water-balance bucket over the window — rain fills it, evapotranspira-
 * tion drains it — and classify the leftover surplus.
 */

/** Hours of history the balance runs over. */
export const BALANCE_WINDOW_HOURS = 120
/** Ceiling on the bucket: past ~30mm of surplus, wetter is still just "wet". */
export const BALANCE_CAP_MM = 30
/** Below this an hour counts as dry — sensor/model noise, not rain. */
export const RAIN_TRACE_MM = 0.2
/**
 * Share of rainfall that never ends up in the trail surface at all: canopy
 * interception plus runoff and percolation down the slope. Trails sit on
 * drained ground, so evaporation alone badly over-estimates how wet they stay
 * — without this term the verified Winterberg payload (13.4mm, then four mild
 * September days) comes out `damp`, which is not what that trail rides like.
 *
 * 0.30 sits inside the range published for forested slopes, and it is the
 * value that leaves the widest margin to every threshold across the fixtures
 * in trailCondition.test.ts. It is still one free parameter fitted against
 * few real observations — the honest place to adjust once there is ground
 * truth from trailcrews.
 */
export const RUNOFF_FRACTION = 0.3

/** Upper bounds (mm of surplus) for the three drier levels; above = wet. */
export const THRESHOLD_DUSTY_MM = 1
export const THRESHOLD_PRIME_MM = 4
export const THRESHOLD_DAMP_MM = 10

/**
 * `soil` spots get a ground verdict; `hard` spots (sealed asphalt pumptracks)
 * only get current weather — asphalt dries in minutes, so a soil-moisture
 * statement about one would be noise dressed up as information.
 */
export type ConditionMode = 'soil' | 'hard'

// Open/Closed dispatch (CLAUDE.md): adding a spot type means adding a row,
// not editing a chain of ifs.
const CONDITION_MODE: Record<Trail['type'], (trail: Trail) => ConditionMode> = {
  trail:    () => 'soil',
  bikepark: () => 'soil',
  // A dirtpark row can be a dirt jump line, an asphalt pumptrack, or both.
  // Only the asphalt-only case is a hard surface.
  dirtpark: (trail) => (isDirtPark(trail) && trail.pumptrack && !trail.dirtpark ? 'hard' : 'soil'),
}

export function conditionModeFor(trail: Trail): ConditionMode {
  return CONDITION_MODE[trail.type](trail)
}

/**
 * Open-Meteo returns local timestamps with no offset (`2026-09-12T00:00`)
 * plus a separate `utc_offset_seconds`. Parsing those directly would read
 * them in the *browser's* timezone, which silently shifts the whole window
 * for anyone not sitting in the spot's timezone.
 */
function hourUtcMs(localTime: string, utcOffsetSeconds: number): number {
  return Date.parse(`${localTime}:00Z`) - utcOffsetSeconds * 1000
}

/**
 * German decimal comma, and no pointless trailing tenth: "13,4" but "40",
 * not "40,0". Hand-rolled rather than Intl so the output is identical under
 * every locale the app might boot in.
 */
function formatMm(mm: number): string {
  if (mm < 0.05) return '0'
  const rounded = mm.toFixed(1)
  return (rounded.endsWith('.0') ? rounded.slice(0, -2) : rounded).replace('.', ',')
}

function isUsable(weather: SpotWeather | null | undefined): weather is SpotWeather {
  if (!weather || !weather.current || !weather.days?.length || !weather.hourly) return false
  const { time, precipitationMm, snowfallCm } = weather.hourly
  if (!time?.length) return false
  if (precipitationMm?.length !== time.length) return false
  if (snowfallCm?.length !== time.length) return false
  // A single null anywhere in the precipitation series makes the balance a lie
  // rather than an approximation — better to say nothing than to guess.
  if (precipitationMm.some((v) => typeof v !== 'number' || Number.isNaN(v))) return false
  if (weather.days.some((d) => typeof d.et0Mm !== 'number' || typeof d.precipitationMm !== 'number')) return false
  return true
}

/**
 * Hours since the last hour with measurable rain, or null if the payload has
 * none. Shared by the verdict text and the status banner's rain rule so the
 * two can never disagree about when it last rained at a spot.
 */
export function hoursSinceLastRain(
  weather: SpotWeather | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!isUsable(weather)) return null
  const nowMs = now.getTime()
  const { time, precipitationMm } = weather.hourly
  for (let i = time.length - 1; i >= 0; i--) {
    const stampMs = hourUtcMs(time[i]!, weather.utcOffsetSeconds)
    if (stampMs > nowMs) continue
    if (precipitationMm[i]! >= RAIN_TRACE_MM) {
      return Math.max(0, Math.round((nowMs - stampMs) / 3600_000))
    }
  }
  return null
}

interface Balance {
  wetnessMm: number
  hoursSinceRain: number | null
  rainWindowMm: number
  snow24hCm: number
  currentRainMmPerHour: number
}

function computeBalance(weather: SpotWeather, now: Date): Balance {
  const et0ByDate = new Map(weather.days.map((d) => [d.date, d.et0Mm]))
  const nowMs = now.getTime()
  const windowStartMs = nowMs - BALANCE_WINDOW_HOURS * 3600_000
  const rainWindowStartMs = nowMs - 72 * 3600_000
  const snowWindowStartMs = nowMs - 24 * 3600_000

  let wetness = 0
  let rainWindowMm = 0
  let snow24hCm = 0

  const { time, precipitationMm, snowfallCm } = weather.hourly

  for (let i = 0; i < time.length; i++) {
    const stampMs = hourUtcMs(time[i]!, weather.utcOffsetSeconds)
    if (stampMs > nowMs) break // forecast hours — not evidence about the ground yet
    if (stampMs < windowStartMs) continue

    const rain = precipitationMm[i]!
    const snow = snowfallCm[i]!
    // Daily et0 spread flat across the day. Crude — it ignores the diurnal
    // cycle — but the seasonal swing (July ~4mm/day vs November ~0.4mm/day)
    // is what actually decides the verdict, and that survives the flattening.
    const et0Hour = (et0ByDate.get(time[i]!.slice(0, 10)) ?? 0) / 24

    // Only the *retained* share enters the bucket. `rain` itself stays intact
    // below — the mm figure shown to the user must be the measured rainfall,
    // not our modelled fraction of it.
    const retained = rain * (1 - RUNOFF_FRACTION)
    wetness = Math.min(BALANCE_CAP_MM, Math.max(0, wetness + retained - et0Hour))

    if (stampMs >= rainWindowStartMs) rainWindowMm += rain
    if (stampMs >= snowWindowStartMs) snow24hCm += snow
  }

  return {
    wetnessMm: wetness,
    // Shared with the status banner's rain rule — see hoursSinceLastRain.
    hoursSinceRain: hoursSinceLastRain(weather, now),
    rainWindowMm,
    snow24hCm,
    currentRainMmPerHour: weather.current.precipitationMm ?? 0,
  }
}

function levelFromWetness(wetnessMm: number): ConditionLevel {
  if (wetnessMm <= THRESHOLD_DUSTY_MM) return 'dusty'
  if (wetnessMm <= THRESHOLD_PRIME_MM) return 'prime'
  if (wetnessMm <= THRESHOLD_DAMP_MM) return 'damp'
  return 'wet'
}

function describe(level: ConditionLevel, weather: SpotWeather, b: Balance): { headline: string; detail: string } {
  const todayMaxTemp = weather.days[weather.days.length - 1]?.tempMax ?? 0

  switch (level) {
    case 'snow': {
      const detail = b.snow24hCm > 0
        ? `${formatMm(b.snow24hCm)} cm Neuschnee. Gefrorener Boden fährt sich gut — beim Auftauen wird er zu Matsch.`
        : `Dauerfrost bei ${Math.round(todayMaxTemp)}°. Gefrorener Boden fährt sich gut — beim Auftauen wird er zu Matsch.`
      return { headline: 'Schnee & Frost', detail }
    }
    case 'raining':
      return {
        headline: 'Es regnet gerade',
        detail: `${formatMm(b.currentRainMmPerHour)} mm/h. Egal wie der Boden vorher war — heute wird es rutschig.`,
      }
    case 'hard':
      return {
        headline: `${Math.round(weather.current.temperature)}°, ${weatherCodeLabel(weather.current.weatherCode).toLowerCase()}`,
        detail: 'Asphalt trocknet in Minuten — für diesen Spot zählt nur, ob es gerade regnet.',
      }
    case 'dusty': {
      const detail = b.hoursSinceRain === null
        ? 'Seit über 5 Tagen kein Regen. Loser Staub in Kurven, spätes Bremsen geht schief.'
        : `Seit ${Math.floor(b.hoursSinceRain / 24)} Tagen kein Regen. Loser Staub in Kurven, spätes Bremsen geht schief.`
      return { headline: 'Staubtrocken', detail }
    }
    case 'prime': {
      const detail = b.hoursSinceRain === null
        ? 'Bester Zustand. Der Boden ist abgetrocknet.'
        : `Bester Zustand. Seit ${b.hoursSinceRain} Stunden kein Regen, Boden hat abgetrocknet.`
      return { headline: 'Griffig', detail }
    }
    case 'damp':
      return {
        headline: 'Feucht, aber fahrbar',
        detail: `${formatMm(b.rainWindowMm)} mm in den letzten 3 Tagen. Wurzeln und Steine sind rutschig, Untergrund trägt noch.`,
      }
    case 'wet':
      return {
        headline: 'Nass und weich',
        detail: `${formatMm(b.rainWindowMm)} mm in den letzten 3 Tagen, kaum Abtrocknung. Reifen schneiden ein — Spuren bleiben lange.`,
      }
    default:
      return { headline: '', detail: '' }
  }
}

const UNKNOWN: TrailCondition = {
  level: 'unknown',
  headline: '',
  detail: '',
  wetnessMm: 0,
  hoursSinceRain: null,
}

export function computeTrailCondition(
  weather: SpotWeather | null | undefined,
  mode: ConditionMode,
  now: Date = new Date(),
): TrailCondition {
  // Guard first: without a usable payload none of the overrides below can be
  // evaluated either, so there is nothing honest to say.
  if (!isUsable(weather)) return UNKNOWN

  const balance = computeBalance(weather, now)
  const todayMaxTemp = weather.days[weather.days.length - 1]?.tempMax ?? 0

  // Precedence: frozen ground beats falling rain beats surface type beats the
  // balance. Snow first because a snowed-in trail is not "wet", it's a
  // different sport.
  let level: ConditionLevel
  if (balance.snow24hCm > 0 || todayMaxTemp < 1) level = 'snow'
  else if (balance.currentRainMmPerHour > 0) level = 'raining'
  else if (mode === 'hard') level = 'hard'
  else level = levelFromWetness(balance.wetnessMm)

  const { headline, detail } = describe(level, weather, balance)

  return {
    level,
    headline,
    detail,
    wetnessMm: balance.wetnessMm,
    hoursSinceRain: balance.hoursSinceRain,
  }
}
