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

/**
 * Hours of history the balance runs over.
 *
 * Ten days rather than five: rain leaving the window drops out of the bucket
 * in a single step, which at five days produced a visible cliff — a December
 * spot went from 8.8mm of surplus ("Feucht") to zero ("Staubtrocken") from one
 * day to the next with no weather to justify it. Ten days pushes that edge out
 * past the range where it bites in practice. It does not remove it: at
 * et0 ≈ 0.4mm/day a soaking genuinely takes weeks to drain, so a hard window
 * always truncates eventually. An exponential decay would remove it entirely.
 */
export const BALANCE_WINDOW_HOURS = 240
/** Ceiling on the bucket: past ~30mm of surplus, wetter is still just "wet". */
export const BALANCE_CAP_MM = 30

/**
 * Evaporation accumulated since the last measurable rain, past which a trail
 * counts as dusty.
 *
 * This is deliberately a *second, independent* signal rather than letting the
 * bucket run negative. Two linked accounts (surplus above zero, deficit below)
 * look more physical but are arithmetically identical to one unclamped
 * counter: without a binding limit the result collapses to "total rain minus
 * total evaporation", which is order-blind — 15mm today and 15mm nine days ago
 * score exactly the same. The bucket only knows about recency *because* it
 * clamps at zero and throws the excess drying away.
 *
 * So the wet side keeps its clamp, and dryness is measured from the last rain
 * instead. Seasonal by construction: 10mm of evaporation is about a week of
 * July, and unreachable in a German December — which is correct, because
 * December trails do not turn to dust.
 */
export const THRESHOLD_DUST_DRYING_MM = 10
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

/**
 * Multiplier on the API's reference evapotranspiration before it drains the
 * bucket — i.e. how fast a trail dries relative to open grassland, which is
 * what et0 actually describes.
 *
 * 1.0 would mean "exactly the FAO reference rate", which describes open,
 * well-watered grassland. A forest trail under canopy sees far less sun and
 * wind than that, and at 1.0 the model called trails dry roughly a day before
 * they ride dry.
 *
 * Kept as its own named knob rather than folded into RUNOFF_FRACTION because
 * the two describe different things: runoff is how much rain never arrives,
 * this is how fast what did arrive leaves again.
 */
export const DRYING_FACTOR = 0.5

/** Upper bounds (mm of surplus) for the wetter levels. */
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
/** The spot's own calendar date at `now`, as `yyyy-mm-dd`. */
export function spotLocalDate(weather: SpotWeather, now: Date): string {
  return new Date(now.getTime() + weather.utcOffsetSeconds * 1000).toISOString().slice(0, 10)
}

/**
 * Index of "today" in `weather.days`.
 *
 * Must not be shortcut to `days.length - 1`: the payload carries forecast days
 * after today (so the strip can show what's coming), and taking the last entry
 * would silently read tomorrow's — or the day after's — temperature into the
 * frost check.
 */
export function todayIndex(weather: SpotWeather, now: Date): number {
  const today = spotLocalDate(weather, now)
  const found = weather.days.findIndex((d) => d.date === today)
  return found === -1 ? weather.days.length - 1 : found
}

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
  /** Signed, for display: positive = free water, negative = drying since rain. */
  wetnessMm: number
  /** Free water only, never negative. */
  surplusMm: number
  /** Evaporation piled up since the last measurable rain. */
  dryingSinceRainMm: number
  hoursSinceRain: number | null
  rainWindowMm: number
  /** Measured rain over the whole balance window. */
  rainBalanceWindowMm: number
  snow24hCm: number
  currentRainMmPerHour: number
  /** Free water expected by the end of today, given the forecast. */
  projectedSurplusMm: number
  /** Forecast rain still to come today. */
  rainAheadMm: number
}

/**
 * One hour of the bucket: retained rain in, evaporation out, clamped at both
 * ends. Shared by the measured pass and the forecast projection so the two can
 * never disagree about how water moves.
 */
function bucketStep(surplus: number, retainedMm: number, et0Hour: number): number {
  return Math.min(BALANCE_CAP_MM, Math.max(0, surplus + retainedMm - et0Hour))
}

/**
 * Runs the bucket forward through the forecast hours of the spot's *own*
 * remaining day — "what will the ground be like by this evening" — starting
 * from the measured surplus. Tomorrow's rain is deliberately not included:
 * the wording it feeds says "im Laufe des Tages", and a forecast a day out is
 * too soft to put in a rider's mouth.
 */
function projectRestOfDay(
  weather: SpotWeather,
  now: Date,
  surplusNow: number,
  et0ByDate: Map<string, number>,
): { projectedSurplusMm: number; rainAheadMm: number } {
  const today = spotLocalDate(weather, now)
  const nowMs = now.getTime()
  const { time, precipitationMm } = weather.hourly
  let surplus = surplusNow
  let rainAheadMm = 0

  for (let i = 0; i < time.length; i++) {
    if (hourUtcMs(time[i]!, weather.utcOffsetSeconds) <= nowMs) continue
    if (time[i]!.slice(0, 10) !== today) break
    const rain = precipitationMm[i]!
    const et0Hour = ((et0ByDate.get(today) ?? 0) / 24) * DRYING_FACTOR
    rainAheadMm += rain
    surplus = bucketStep(surplus, rain * (1 - RUNOFF_FRACTION), et0Hour)
  }
  return { projectedSurplusMm: surplus, rainAheadMm }
}

function computeBalance(weather: SpotWeather, now: Date): Balance {
  const et0ByDate = new Map(weather.days.map((d) => [d.date, d.et0Mm]))
  const nowMs = now.getTime()
  const windowStartMs = nowMs - BALANCE_WINDOW_HOURS * 3600_000
  const rainWindowStartMs = nowMs - 72 * 3600_000
  const snowWindowStartMs = nowMs - 24 * 3600_000

  // Two independent signals, because one number cannot carry both halves of
  // the question. `surplus` is free water — what makes a spot slick.
  // `dryingSinceRain` is how hard the sun has worked since it last rained —
  // what eventually makes a spot dusty.
  let surplus = 0
  let dryingSinceRain = 0
  let rainWindowMm = 0
  let rainBalanceWindowMm = 0
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
    const et0Hour = ((et0ByDate.get(time[i]!.slice(0, 10)) ?? 0) / 24) * DRYING_FACTOR

    // Only the *retained* share enters the bucket. `rain` itself stays intact
    // below — the mm figure shown to the user must be the measured rainfall,
    // not our modelled fraction of it.
    // Free water: clamped at zero, and the clamp is the point — throwing the
    // excess drying away is what lets the bucket forget old rain.
    const retained = rain * (1 - RUNOFF_FRACTION)
    surplus = bucketStep(surplus, retained, et0Hour)

    // Dryness: evaporation piled up since the last rain, reset by any rain
    // worth the name. Independent of the bucket, so it survives the clamp.
    if (rain >= RAIN_TRACE_MM) dryingSinceRain = 0
    else dryingSinceRain += et0Hour

    rainBalanceWindowMm += rain
    if (stampMs >= rainWindowStartMs) rainWindowMm += rain
    if (stampMs >= snowWindowStartMs) snow24hCm += snow
  }

  const { projectedSurplusMm, rainAheadMm } = projectRestOfDay(weather, now, surplus, et0ByDate)

  return {
    // One signed number for the UI: positive is free water, negative is how
    // much evaporation has piled up since the last rain.
    wetnessMm: surplus > 0 ? surplus : -dryingSinceRain,
    surplusMm: surplus,
    dryingSinceRainMm: dryingSinceRain,
    // Shared with the status banner's rain rule — see hoursSinceLastRain.
    hoursSinceRain: hoursSinceLastRain(weather, now),
    rainWindowMm,
    rainBalanceWindowMm,
    snow24hCm,
    currentRainMmPerHour: weather.current.precipitationMm ?? 0,
    projectedSurplusMm,
    rainAheadMm,
  }
}

function levelFromBalance(b: Balance): ConditionLevel {
  // Wetness first — a trail carrying free water is never dusty, whatever the
  // calendar says.
  if (b.surplusMm > THRESHOLD_DAMP_MM) return 'wet'
  if (b.surplusMm > THRESHOLD_PRIME_MM) return 'damp'
  if (b.dryingSinceRainMm >= THRESHOLD_DUST_DRYING_MM) return 'dusty'
  return 'prime'
}

function describe(
  level: ConditionLevel,
  weather: SpotWeather,
  b: Balance,
  todayMaxTemp: number,
): { headline: string; detail: string } {

  switch (level) {
    case 'snow': {
      const detail = b.snow24hCm > 0
        ? `${formatMm(b.snow24hCm)} cm Neuschnee. Gefrorener Boden fährt sich gut — beim Auftauen wird er zu Matsch.`
        : `Dauerfrost bei ${Math.round(todayMaxTemp)}°. Gefrorener Boden fährt sich gut — beim Auftauen wird er zu Matsch.`
      return { headline: 'Schnee & Frost', detail }
    }
    case 'raining': {
      // "Slippery" is the wrong thing to say about a downpour and the right
      // thing to say about a shower, so the wording follows where the bucket
      // will stand by this evening — read with the same thresholds as the
      // ground states, which keeps "schlammig" meaning what "Nass und weich"
      // means everywhere else. Mentioning the amount still to come is what
      // lets a rider judge the claim; below half a millimetre it is noise.
      const rate = `${formatMm(b.currentRainMmPerHour)} mm/h`
      const ahead = b.rainAheadMm >= 0.5 ? `, bis heute Abend noch ca. ${formatMm(b.rainAheadMm)} mm` : ''
      let outlook: string
      if (b.projectedSurplusMm > THRESHOLD_DAMP_MM) {
        outlook = b.surplusMm > THRESHOLD_DAMP_MM
          ? 'Der Boden ist schon nass — mit dem Regen wird es schlammig.'
          : 'Im Laufe des Tages wird es schlammig.'
      } else if (b.projectedSurplusMm > THRESHOLD_PRIME_MM) {
        outlook = 'Im Laufe des Tages wird der Boden feucht — Wurzeln und Steine werden rutschig.'
      } else {
        outlook = 'Nur leichter Regen — Wurzeln und Steine sind nass und rutschig, der Boden bleibt weitgehend griffig.'
      }
      return { headline: 'Es regnet gerade', detail: `${rate}${ahead}. ${outlook}` }
    }
    case 'hard':
      return {
        headline: `${Math.round(weather.current.temperature)}°, ${weatherCodeLabel(weather.current.weatherCode).toLowerCase()}`,
        detail: 'Asphalt trocknet in Minuten — für diesen Spot zählt nur, ob es gerade regnet.',
      }
    case 'dusty': {
      const detail = b.hoursSinceRain === null
        // Derived from the window, not written out — the two drifted apart
        // once the window was widened.
        ? `Seit über ${Math.floor(BALANCE_WINDOW_HOURS / 24)} Tagen kein Regen. Loser Sand und Geröll in Kurven rutschig.`
        : `Seit ${Math.floor(b.hoursSinceRain / 24)} Tagen kein Regen. Loser Sand in Kurven rutschig.`
      return { headline: 'Staubtrocken', detail }
    }
    case 'prime': {
      const detail = b.hoursSinceRain === null
        ? 'Bester Zustand. Der Boden ist abgetrocknet.'
        : `Bester Zustand. Seit ${b.hoursSinceRain} Stunden kein Regen, Boden weitgehend abgetrocknet.`
      return { headline: 'Hero Dirt', detail }
    }
    case 'damp':
      return {
        headline: 'Feucht, aber gut fahrbar',
        detail: `${formatMm(b.rainWindowMm)} mm in den letzten 3 Tagen. Wurzeln und Steine sind evtl. rutschig.`,
      }
    case 'wet':
      return {
        headline: 'Nass und weich',
        detail: `${formatMm(b.rainWindowMm)} mm in den letzten 3 Tagen, kaum Abtrocknung. Reifen hinterlassen Spuren.`,
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
  rain10dMm: 0,
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
  const todayMaxTemp = weather.days[todayIndex(weather, now)]?.tempMax ?? 0

  // Precedence: frozen ground beats falling rain beats surface type beats the
  // balance. Snow first because a snowed-in trail is not "wet", it's a
  // different sport.
  let level: ConditionLevel
  if (balance.snow24hCm > 0 || todayMaxTemp < 1) level = 'snow'
  else if (balance.currentRainMmPerHour > 0) level = 'raining'
  else if (mode === 'hard') level = 'hard'
  else level = levelFromBalance(balance)

  const { headline, detail } = describe(level, weather, balance, todayMaxTemp)

  return {
    level,
    headline,
    detail,
    wetnessMm: balance.wetnessMm,
    hoursSinceRain: balance.hoursSinceRain,
    rain10dMm: balance.rainBalanceWindowMm,
  }
}
