import type { TrailConditionResponse, SpotWeather, DayWeather } from '~/types/Weather'
import { FUNCTIONS, userHeaders } from './http'

/**
 * Trail-Zustand from the `trail-condition` edge function.
 *
 * The function is the gate (JWT + `has_min_tier`) and owns Open-Meteo, the
 * water-balance model and its constants; this file only asks for the finished
 * view-model. The caller passes the user's access token, since communication/
 * must not reach into stores.
 */

export const TRAIL_CONDITION_CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_PREFIX = 'tr_wx_v2_'

function cacheKey(spotType: string, spotId: string): string {
  return `${CACHE_PREFIX}${spotType}_${spotId}`
}

interface CacheEntry {
  at: number
  condition: TrailConditionResponse
}

function isCondition(value: unknown): value is TrailConditionResponse {
  const v = value as TrailConditionResponse | null
  return !!v && typeof v.verdict?.level === 'string' && !!v.rainRule && !!v.current && Array.isArray(v.strip)
}

function readCache(key: string, now: number): TrailConditionResponse | null {
  // No localStorage during prerender, and it throws outright in some private
  // browsing modes — a missing cache must never take the page down.
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (!entry?.at || !isCondition(entry.condition)) throw new Error('corrupt cache entry')
    if (now - entry.at > TRAIL_CONDITION_CACHE_TTL_MS) return null
    return entry.condition
  } catch {
    // Corrupt entry — drop it rather than letting it poison every later read.
    clearCache(key)
    return null
  }
}

function writeCache(key: string, condition: TrailConditionResponse, now: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ at: now, condition } satisfies CacheEntry))
  } catch { /* quota or private mode — the fetch still succeeded, so carry on */ }
}

function clearCache(key: string): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(key) } catch { /* nothing sensible left to do */ }
}

/**
 * Never throws and never rejects: the card is advisory, so a dead function, an
 * offline PWA or a refusal must degrade to "no card", not to a broken spot page.
 *
 * `onForbidden` fires on a 403 (the user is not entitled, e.g. a stale
 * entitlement in the browser) so the page can show the locked teaser instead of
 * an empty gap; a 403 also drops the cached card, so a downgraded user does not
 * keep seeing what they no longer pay for.
 */
export async function fetchTrailCondition(
  spotType: string,
  spotId: string,
  accessToken: string,
  onForbidden?: () => void,
): Promise<TrailConditionResponse | null> {
  const key = cacheKey(spotType, spotId)
  const now = Date.now()

  const cached = readCache(key, now)
  if (cached) return cached

  try {
    const res = await fetch(`${FUNCTIONS}/trail-condition`, {
      method: 'POST',
      headers: userHeaders(accessToken),
      body: JSON.stringify({ spotType, spotId }),
    })
    if (res.status === 403) {
      clearCache(key)
      onForbidden?.()
      return null
    }
    if (!res.ok) return null
    const body: unknown = await res.json()
    if (!isCondition(body)) return null
    writeCache(key, body, now)
    return body
  } catch {
    return null
  }
}

// ── LEGACY — delete with the client model (plan task F6) ────────────────────
// The raw Open-Meteo mapping now lives in the backend (`openMeteo.ts`). It stays
// here only because the old client model's tests and scripts/soil-backtest still
// import it until the model is deleted; nothing in the app calls it.

interface RawResponse {
  utc_offset_seconds?: number
  timezone?: string
  elevation?: number
  current?: Record<string, number>
  daily?: Record<string, unknown[]>
  hourly?: Record<string, unknown[]>
}

function numbers(input: unknown): number[] | null {
  if (!Array.isArray(input)) return null
  return input.map((v) => (typeof v === 'number' ? v : NaN))
}

/**
 * Maps the raw payload onto `SpotWeather`, or returns null if anything the
 * verdict depends on is missing. Returning null rather than a half-filled
 * object keeps the "say nothing instead of guessing" decision in one place.
 */
export function mapWeatherResponse(raw: RawResponse | null | undefined): SpotWeather | null {
  if (!raw?.current || !raw.daily || !raw.hourly) return null

  const dailyTime = raw.daily.time
  if (!Array.isArray(dailyTime) || dailyTime.length === 0) return null

  const precipSum = numbers(raw.daily.precipitation_sum)
  const et0 = numbers(raw.daily.et0_fao_evapotranspiration)
  const snowSum = numbers(raw.daily.snowfall_sum)
  const tempMax = numbers(raw.daily.temperature_2m_max)
  const tempMin = numbers(raw.daily.temperature_2m_min)
  const dailyCode = numbers(raw.daily.weather_code)
  if (!precipSum || !et0 || !snowSum || !tempMax || !tempMin || !dailyCode) return null

  const days: DayWeather[] = dailyTime.map((date, i) => ({
    date: String(date),
    weatherCode: dailyCode[i] ?? 0,
    precipitationMm: precipSum[i] ?? 0,
    snowfallCm: snowSum[i] ?? 0,
    tempMax: tempMax[i] ?? 0,
    tempMin: tempMin[i] ?? 0,
    et0Mm: et0[i] ?? 0,
  }))

  const hourlyTime = raw.hourly.time
  const hourlyPrecip = numbers(raw.hourly.precipitation)
  const hourlySnow = numbers(raw.hourly.snowfall)
  if (!Array.isArray(hourlyTime) || !hourlyPrecip || !hourlySnow) return null

  return {
    current: {
      temperature: raw.current.temperature_2m ?? 0,
      apparentTemperature: raw.current.apparent_temperature ?? raw.current.temperature_2m ?? 0,
      weatherCode: raw.current.weather_code ?? 0,
      precipitationMm: raw.current.precipitation ?? 0,
      windKmh: raw.current.wind_speed_10m ?? 0,
    },
    days,
    hourly: {
      time: hourlyTime.map(String),
      precipitationMm: hourlyPrecip,
      snowfallCm: hourlySnow,
    },
    utcOffsetSeconds: raw.utc_offset_seconds ?? 0,
    timezone: raw.timezone ?? 'UTC',
    elevation: raw.elevation ?? 0,
  }
}
