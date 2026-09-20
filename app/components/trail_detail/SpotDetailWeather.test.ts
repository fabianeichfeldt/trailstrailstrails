import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Trail, DirtPark } from '~/types/Trail'
import { fetchSpotWeather } from '~/communication/weather'
import SpotDetailWeather from './SpotDetailWeather.vue'

// ── Fixtures ───────────────────────────────────────────────────────────────
// Built relative to "today" so the payload always lands inside the balance
// window, exactly as a live response would. Rain falls at 12:00 on past days
// only — never today, whose 12:00 may still be in the future when the suite
// runs.

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

interface DaySpec { precip: number; et0: number; code?: number; tempMax?: number }

/** Three forecast days, dry and mild — the live payload always carries them. */
const FORECAST: DaySpec[] = [
  { precip: 0, et0: 2 },
  { precip: 0, et0: 2 },
  { precip: 0, et0: 2 },
]

/**
 * A raw Open-Meteo payload, same shape the live API returns.
 *
 * `past` ends with today; `future` is appended after it, so the day list spans
 * past → today → forecast exactly as the real response does.
 */
function rawPayload(past: DaySpec[], current: Record<string, number> = {}, future: DaySpec[] = FORECAST) {
  const days = [...past, ...future]
  const dates = days.map((_, i) => isoDaysAgo(past.length - 1 - i))
  const todayIdx = past.length - 1
  const time: string[] = []
  const precipitation: number[] = []
  const snowfall: number[] = []
  dates.forEach((date, dayIndex) => {
    for (let h = 0; h < 24; h++) {
      time.push(`${date}T${String(h).padStart(2, '0')}:00`)
      // Rain lands at 12:00 on past days only — today's noon may still be in
      // the future when the suite runs, and forecast rain must never reach
      // the balance.
      const isPastDay = dayIndex < todayIdx
      precipitation.push(h === 12 && isPastDay ? days[dayIndex]!.precip : 0)
      snowfall.push(0)
    }
  })

  return {
    utc_offset_seconds: 0,
    timezone: 'UTC',
    elevation: 693,
    current: {
      temperature_2m: 12,
      apparent_temperature: 10,
      weather_code: 2,
      precipitation: 0,
      wind_speed_10m: 13,
      ...current,
    },
    daily: {
      time: dates,
      weather_code: days.map((d) => d.code ?? 2),
      precipitation_sum: days.map((d) => d.precip),
      temperature_2m_max: days.map((d) => d.tempMax ?? 18),
      temperature_2m_min: days.map(() => 9),
      et0_fao_evapotranspiration: days.map((d) => d.et0),
      snowfall_sum: days.map(() => 0),
    },
    hourly: { time, precipitation, snowfall },
  }
}

/** The verified Winterberg pattern: 13.4mm, then four mild drying days. */
const WINTERBERG: DaySpec[] = [
  { precip: 0, et0: 2.01 },
  { precip: 13.4, et0: 0.61, code: 61 },
  { precip: 0, et0: 2.03 },
  { precip: 0, et0: 2.58, code: 0 },
  { precip: 1.1, et0: 1.73, code: 80 },
  { precip: 0, et0: 1.61 },
]

const SOAKED_NOVEMBER: DaySpec[] = [
  { precip: 0, et0: 0.4 },
  { precip: 0, et0: 0.4 },
  { precip: 14, et0: 0.4, code: 63 },
  { precip: 13, et0: 0.4, code: 63 },
  { precip: 13, et0: 0.4, code: 63 },
  { precip: 0, et0: 0.4, tempMax: 6 },
]

const trail = { type: 'trail', id: 't1', name: 'Flowtrail' } as Trail

function mockFetch(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload }))
}

const realFetch = globalThis.fetch

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  // Deliberately NOT vi.unstubAllGlobals(): that also tears down the `ref`/
  // `computed` stubs vitest.setup.ts installs to stand in for Nuxt's build-time
  // auto-imports, so every component mounted after the first test would die
  // with "computed is not defined". Restore only what this file replaced.
  globalThis.fetch = realFetch
})

// ── The chain that actually ships ──────────────────────────────────────────
// Only the network boundary is mocked. Everything between the raw API JSON
// and the German text a rider reads is the real code path.

describe('SpotDetailWeather — from raw API response to rendered card', () => {
  it('turns the verified Winterberg payload into a "Feucht" card with its evidence', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })
    const text = wrapper.text()

    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(true)
    expect(text).toContain('Trail-Zustand')
    expect(text).toContain('Feucht, aber fahrbar')
    expect(text).toContain('12°')
    expect(text).toContain('Open-Meteo')
    // Rain inside the displayed window shows up as evidence.
    expect(text).toContain('1,1')

    // Six columns: two measured days, today, three forecast days.
    const columns = wrapper.findAll('.wx-day')
    expect(columns).toHaveLength(6)
    expect(columns[2]!.classes()).toContain('today')
    expect(columns[2]!.text()).toContain('Heute')
    expect(wrapper.findAll('.wx-day.forecast')).toHaveLength(3)
    // Nothing up to and including today may be marked as forecast.
    for (const measured of columns.slice(0, 3)) expect(measured.classes()).not.toContain('forecast')
  })

  it('turns a soaked November payload into a "Nass" card with the trail-care nudge', async () => {
    mockFetch(rawPayload(SOAKED_NOVEMBER, { temperature_2m: 6, weather_code: 63 }))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })
    const text = wrapper.text()

    expect(text).toContain('Nass und weich')
    expect(text).toContain('Trails schonen')
    expect(wrapper.find('.wx-care').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weather-card"]').classes()).toContain('v-wet')
  })

  it('does not show the trail-care nudge on a dry spot', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    expect(wrapper.find('.wx-care').exists()).toBe(false)
  })

  it('renders nothing at all when the API could not be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    expect(weather).toBeNull()
    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })
})

describe('SpotDetailWeather — states', () => {
  it('renders a skeleton while loading, never a verdict', async () => {
    const wrapper = mount(SpotDetailWeather, { props: { trail, weather: null, loading: true } })

    expect(wrapper.find('[data-testid="weather-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Griffig')
  })

  it('gives an asphalt pumptrack current weather and no evidence strip', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)
    const pumptrack = { type: 'dirtpark', id: 'p1', pumptrack: true, dirtpark: false } as DirtPark

    const wrapper = mount(SpotDetailWeather, { props: { trail: pumptrack, weather, loading: false } })

    expect(wrapper.text()).toContain('Asphalt trocknet in Minuten')
    expect(wrapper.findAll('.wx-day')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Griffig')
  })

  it('keeps a soil verdict for a dirt jump spot that also has a pumptrack', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)
    const mixed = { type: 'dirtpark', id: 'p2', pumptrack: true, dirtpark: true } as DirtPark

    const wrapper = mount(SpotDetailWeather, { props: { trail: mixed, weather, loading: false } })

    expect(wrapper.text()).toContain('Feucht, aber fahrbar')
    expect(wrapper.findAll('.wx-day')).toHaveLength(6)
  })

  it('drops the evidence strip while it is raining — the headline no longer rests on it', async () => {
    mockFetch(rawPayload(WINTERBERG, { precipitation: 0.4, weather_code: 63 }))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    expect(wrapper.text()).toContain('Es regnet gerade')
    expect(wrapper.findAll('.wx-day')).toHaveLength(0)
  })

  it('labels the verdict as calculated, not as a trailcrew statement', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    expect(wrapper.text()).toContain('keine Trailcrew-Angabe')
  })
})
