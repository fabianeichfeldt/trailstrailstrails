import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  fetchSpotWeather,
  buildWeatherUrl,
  weatherCacheKey,
  mapWeatherResponse,
  WEATHER_CACHE_TTL_MS,
} from './weather'

// Shaped exactly like the live Open-Meteo response (verified against
// api.open-meteo.com for Winterberg on 2026-09-17), trimmed to three days so
// the fixture stays readable. No test in this file ever reaches the network.
function rawPayload(overrides: Record<string, unknown> = {}) {
  return {
    latitude: 51.2,
    longitude: 8.52,
    utc_offset_seconds: 7200,
    timezone: 'Europe/Berlin',
    elevation: 693,
    current: {
      time: '2026-09-17T21:00',
      temperature_2m: 12,
      apparent_temperature: 9.2,
      weather_code: 3,
      precipitation: 0,
      wind_speed_10m: 13.1,
    },
    daily: {
      time: ['2026-09-15', '2026-09-16', '2026-09-17'],
      weather_code: [2, 61, 3],
      precipitation_sum: [0, 1.1, 0],
      temperature_2m_max: [18.4, 16.2, 15.1],
      temperature_2m_min: [8.1, 9.4, 9.9],
      et0_fao_evapotranspiration: [2.58, 1.73, 1.61],
      snowfall_sum: [0, 0, 0],
    },
    hourly: {
      time: Array.from({ length: 72 }, (_, i) => {
        const day = 15 + Math.floor(i / 24)
        return `2026-09-${day}T${String(i % 24).padStart(2, '0')}:00`
      }),
      precipitation: Array.from({ length: 72 }, (_, i) => (i === 36 ? 1.1 : 0)),
      snowfall: Array.from({ length: 72 }, () => 0),
    },
    ...overrides,
  }
}

function mockFetchOnce(payload: unknown, ok = true, status = 200) {
  const spy = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => payload,
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('buildWeatherUrl', () => {
  it('requests past days, current conditions and the fields the balance needs', () => {
    const url = buildWeatherUrl(51.1927, 8.5236)

    expect(url).toContain('https://api.open-meteo.com/v1/forecast')
    expect(url).toContain('latitude=51.1927')
    expect(url).toContain('longitude=8.5236')
    // Ten past days feed the 240h balance; three ahead fill the right half
    // of the strip, which centres on today.
    expect(url).toContain('past_days=10')
    expect(url).toContain('forecast_days=3')
    expect(url).toContain('timezone=auto')
    // Evapotranspiration is what makes the verdict seasonal — losing it from
    // the query would silently turn the balance into a plain rain sum.
    expect(decodeURIComponent(url)).toContain('et0_fao_evapotranspiration')
    expect(decodeURIComponent(url)).toContain('precipitation')
    expect(decodeURIComponent(url)).toContain('snowfall')
  })

  it('carries no API key or credential', () => {
    const url = buildWeatherUrl(51.19, 8.52).toLowerCase()

    expect(url).not.toContain('key=')
    expect(url).not.toContain('token')
    expect(url).not.toContain('apikey')
  })
})

describe('weatherCacheKey', () => {
  it('rounds to ~1km so neighbouring spots share one answer', () => {
    expect(weatherCacheKey(51.1927, 8.5236)).toBe(weatherCacheKey(51.1949, 8.5201))
  })

  it('keeps genuinely different locations apart', () => {
    expect(weatherCacheKey(51.19, 8.52)).not.toBe(weatherCacheKey(47.8, 12.1))
  })
})

describe('mapWeatherResponse', () => {
  it('maps the live payload shape onto SpotWeather', () => {
    const weather = mapWeatherResponse(rawPayload())!

    expect(weather.current.temperature).toBe(12)
    expect(weather.current.apparentTemperature).toBe(9.2)
    expect(weather.utcOffsetSeconds).toBe(7200)
    expect(weather.elevation).toBe(693)
    expect(weather.days).toHaveLength(3)
    expect(weather.days[1]).toMatchObject({ date: '2026-09-16', precipitationMm: 1.1, et0Mm: 1.73 })
    expect(weather.hourly.time).toHaveLength(72)
  })

  it('returns null when the daily block is missing entirely', () => {
    expect(mapWeatherResponse({ current: {}, hourly: {} })).toBeNull()
  })

  it('returns null when evapotranspiration is absent', () => {
    const raw = rawPayload()
    delete (raw.daily as Record<string, unknown>).et0_fao_evapotranspiration

    expect(mapWeatherResponse(raw)).toBeNull()
  })

  it('returns null on an Open-Meteo error envelope', () => {
    expect(mapWeatherResponse({ error: true, reason: 'bad parameter' } as never)).toBeNull()
  })
})

describe('fetchSpotWeather', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('fetches and returns weather on a cache miss', async () => {
    const spy = mockFetchOnce(rawPayload())

    const weather = await fetchSpotWeather(51.1927, 8.5236)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(weather?.days).toHaveLength(3)
    expect(weather?.current.temperature).toBe(12)
  })

  it('serves the second call from cache without touching the network', async () => {
    const spy = mockFetchOnce(rawPayload())

    await fetchSpotWeather(51.1927, 8.5236)
    const second = await fetchSpotWeather(51.1927, 8.5236)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(second?.current.temperature).toBe(12)
  })

  it('refetches once the cached entry has aged past its TTL', async () => {
    const spy = mockFetchOnce(rawPayload())
    await fetchSpotWeather(51.1927, 8.5236)

    const key = weatherCacheKey(51.1927, 8.5236)
    const entry = JSON.parse(localStorage.getItem(key)!)
    entry.at = Date.now() - WEATHER_CACHE_TTL_MS - 1000
    localStorage.setItem(key, JSON.stringify(entry))

    await fetchSpotWeather(51.1927, 8.5236)

    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('discards a corrupt cache entry and refetches', async () => {
    const key = weatherCacheKey(51.1927, 8.5236)
    localStorage.setItem(key, '{not json')
    const spy = mockFetchOnce(rawPayload())

    const weather = await fetchSpotWeather(51.1927, 8.5236)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(weather).not.toBeNull()
    expect(localStorage.getItem(key)).not.toBe('{not json')
  })

  it('returns null and caches nothing when the API rate-limits', async () => {
    mockFetchOnce({ reason: 'daily limit exceeded' }, false, 429)

    const weather = await fetchSpotWeather(51.1927, 8.5236)

    expect(weather).toBeNull()
    expect(localStorage.getItem(weatherCacheKey(51.1927, 8.5236))).toBeNull()
  })

  it('returns null instead of throwing when the network is gone', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(fetchSpotWeather(51.1927, 8.5236)).resolves.toBeNull()
  })

  it('returns null instead of throwing when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token <') },
    }))

    await expect(fetchSpotWeather(51.1927, 8.5236)).resolves.toBeNull()
  })

  it('returns null when the payload is missing the fields the verdict needs', async () => {
    const raw = rawPayload()
    delete (raw as Record<string, unknown>).hourly
    mockFetchOnce(raw)

    await expect(fetchSpotWeather(51.1927, 8.5236)).resolves.toBeNull()
  })
})
