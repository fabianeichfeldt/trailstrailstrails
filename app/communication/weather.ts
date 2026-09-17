import type { SpotWeather, DayWeather } from '~/types/Weather'

/**
 * Spot weather from Open-Meteo.
 *
 * Not a Supabase call, so this file does not use `REST`/`anonHeaders()` from
 * ./http.ts — the architecture rule those enforce is specifically about the
 * Supabase project URL never being hardcoded outside http.ts, which this
 * third-party endpoint is not.
 *
 * No API key: Open-Meteo's free tier needs none, which is the whole reason it
 * beats the alternatives for a static, server-less deployment — there is no
 * secret to leak into the client bundle and nothing to rotate. The free tier
 * is non-commercial (<10k calls/day); this module is the seam to swap in
 * Bright Sky/DWD if that ever stops applying.
 */

const WEATHER_API = 'https://api.open-meteo.com/v1/forecast'

/** Days of history fetched — five back plus today fills the evidence strip. */
export const PAST_DAYS = 5

export const WEATHER_CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_PREFIX = 'tr_wx_v1_'

/**
 * Coordinates are rounded to ~1km before they become a cache key. Open-Meteo
 * resolves to a model grid of roughly that size anyway, so two spots on the
 * same hillside genuinely share an answer — and sharing the entry keeps the
 * call count down.
 */
export function weatherCacheKey(lat: number, lon: number): string {
  return `${CACHE_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}`
}

export function buildWeatherUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    past_days: String(PAST_DAYS),
    forecast_days: '1',
    timezone: 'auto',
    current: 'temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m',
    daily: 'weather_code,precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration,snowfall_sum',
    hourly: 'precipitation,snowfall',
  })
  return `${WEATHER_API}?${params.toString()}`
}

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

interface CacheEntry {
  at: number
  weather: SpotWeather
}

function readCache(key: string, now: number): SpotWeather | null {
  // No localStorage during prerender, and it throws outright in some private
  // browsing modes — a missing cache must never take the page down.
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (!entry?.at || !entry.weather) return null
    if (now - entry.at > WEATHER_CACHE_TTL_MS) return null
    return entry.weather
  } catch {
    // Corrupt entry — drop it rather than letting it poison every later read.
    try { localStorage.removeItem(key) } catch { /* nothing sensible left to do */ }
    return null
  }
}

function writeCache(key: string, weather: SpotWeather, now: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ at: now, weather } satisfies CacheEntry))
  } catch { /* quota or private mode — the fetch still succeeded, so carry on */ }
}

/**
 * Never throws and never rejects: the weather card is advisory, so a dead
 * API, an offline PWA or a rate-limit response must degrade to "no card", not
 * to a broken spot page.
 */
export async function fetchSpotWeather(lat: number, lon: number): Promise<SpotWeather | null> {
  const key = weatherCacheKey(lat, lon)
  const now = Date.now()

  const cached = readCache(key, now)
  if (cached) return cached

  try {
    const res = await fetch(buildWeatherUrl(lat, lon))
    if (!res.ok) return null
    const weather = mapWeatherResponse(await res.json())
    if (!weather) return null
    writeCache(key, weather, now)
    return weather
  } catch {
    return null
  }
}
