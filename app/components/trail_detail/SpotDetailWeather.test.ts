import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import type { Trail, DirtPark } from '~/types/Trail'
import { fetchSpotWeather, FORECAST_DAYS } from '~/communication/weather'
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
    expect(text).toContain('Feucht, aber gut fahrbar')
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

  it('shows three days ahead from a payload shaped like the live API request', async () => {
    // FORECAST_DAYS counts today, so the API returns FORECAST_DAYS - 1 days
    // after it. The strip is designed for three; asking the API for one day
    // too few silently left a rider with two.
    const live = Array.from({ length: FORECAST_DAYS - 1 }, () => ({ precip: 0, et0: 2 }))
    mockFetch(rawPayload(WINTERBERG, {}, live))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    expect(wrapper.findAll('.wx-day.forecast')).toHaveLength(3)
  })

  it('turns a soaked November payload into a "Schlammig" card with the trail-care nudge', async () => {
    mockFetch(rawPayload(SOAKED_NOVEMBER, { temperature_2m: 6, weather_code: 63 }))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })
    const text = wrapper.text()

    expect(text).toContain('Schlammig')
    expect(text).toContain('Trails schonen')
    expect(wrapper.find('.wx-care').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weather-card"]').classes()).toContain('v-wet')
  })

  it('states how much rain fell over the last 10 days, so the verdict can be checked', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    // 13.4mm + 1.1mm — the strip only shows two past days, so without this
    // line the 13.4 would be invisible even though the verdict rests on it.
    const total = wrapper.find('[data-testid="rain-10d"]')
    expect(total.exists()).toBe(true)
    expect(total.text()).toContain('10 Tage')
    expect(total.text()).toContain('14,5 mm')
  })

  it('credits Open-Meteo with a link, on the same row as the "calculated" note', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    // Attribution is a condition of Open-Meteo's free tier, so it must stay on
    // the card. It shares the footer row with the statement that the verdict is
    // calculated: both are about where the numbers come from.
    const foot = wrapper.find('.wx-foot')
    expect(foot.text()).toContain('Berechnete Angabe')
    const link = foot.find('a')
    expect(link.exists()).toBe(true)
    expect(link.text()).toContain('Open-Meteo')
    expect(link.attributes('href')).toBe('https://open-meteo.com/')
    expect(link.attributes('rel')).toContain('noopener')
    expect(link.attributes('target')).toBe('_blank')
  })

  it('as a sample: is marked as one, and credits nobody for data that is made up', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false, sample: true } })

    // A different test id, so "a real card is showing" stays a question the paywall tests can ask.
    expect(wrapper.find('[data-testid="weather-sample"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(false)
    // The Open-Meteo credit is for Open-Meteo data; a fixed sample has none.
    expect(wrapper.find('.wx-foot a').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Open-Meteo')
    // Otherwise it is the real card, strip and all.
    expect(wrapper.findAll('.wx-day')).toHaveLength(6)
  })

  it('puts the 10-day rain directly under the verdict, above the strip', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    // Inside the verdict block, so it reads as part of the statement it backs up.
    const inVerdict = wrapper.find('.wx-verdict [data-testid="rain-10d"]')
    expect(inVerdict.exists()).toBe(true)
    // ...and the verdict block comes before the evidence strip in the card.
    const html = wrapper.html()
    expect(html.indexOf('data-testid="rain-10d"')).toBeLessThan(html.indexOf('class="wx-strip"'))
  })

  it('draws the weather icons big enough to read on a desktop screen', () => {
    const source = readFileSync(resolve(__dirname, 'SpotDetailWeather.vue'), 'utf8')
    const size = (selector: string): number => {
      // First (base, non-media-query) declaration of the selector.
      const rule = source.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))
      const px = rule?.[1]?.match(/font-size:\s*(\d+)px/)
      return px ? Number(px[1]) : 0
    }

    expect(size('.wx-day-icon')).toBeGreaterThanOrEqual(24)
    expect(size('.wx-now-icon')).toBeGreaterThanOrEqual(26)
  })

  it('sums a soaked spot to the full amount, not a per-day figure', async () => {
    mockFetch(rawPayload(SOAKED_NOVEMBER, { temperature_2m: 6, weather_code: 63 }))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    expect(wrapper.find('[data-testid="rain-10d"]').text()).toContain('40 mm')
  })

  it('does not dim the forecast days — riders plan trips around them', () => {
    // Scoped CSS is not applied under jsdom, so assert on the stylesheet
    // source: a forecast column must keep full opacity. Hollow bars are what
    // separates a prediction from a measurement.
    const source = readFileSync(resolve(__dirname, 'SpotDetailWeather.vue'), 'utf8')
    const rules = [...source.matchAll(/([^{}]*\.wx-day\.forecast[^{}]*)\{([^}]*)\}/g)]

    expect(rules.length).toBeGreaterThan(0)
    for (const [, , body] of rules) expect(body).not.toMatch(/opacity|filter\s*:/)
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
    expect(wrapper.text()).not.toContain('Hero Dirt')
  })

  it('gives an asphalt pumptrack current weather and the forecast, but no ground verdict', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)
    const pumptrack = { type: 'dirtpark', id: 'p1', pumptrack: true, dirtpark: false } as DirtPark

    const wrapper = mount(SpotDetailWeather, { props: { trail: pumptrack, weather, loading: false } })

    expect(wrapper.text()).toContain('Asphalt trocknet in Minuten')
    expect(wrapper.text()).not.toContain('Hero Dirt')
    // For asphalt the forecast is the whole point: it decides if the session is on.
    expect(wrapper.findAll('.wx-day')).toHaveLength(6)
    // The 10-day rain is shown in every state, asphalt included.
    expect(wrapper.find('[data-testid="rain-10d"]').text()).toContain('14,5 mm')
  })

  it('keeps a soil verdict for a dirt jump spot that also has a pumptrack', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)
    const mixed = { type: 'dirtpark', id: 'p2', pumptrack: true, dirtpark: true } as DirtPark

    const wrapper = mount(SpotDetailWeather, { props: { trail: mixed, weather, loading: false } })

    expect(wrapper.text()).toContain('Feucht, aber gut fahrbar')
    expect(wrapper.findAll('.wx-day')).toHaveLength(6)
  })

  it('keeps the forecast strip while it is raining — "when does it stop" is the question', async () => {
    mockFetch(rawPayload(WINTERBERG, { precipitation: 0.4, weather_code: 63 }))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    expect(wrapper.text()).toContain('Es regnet gerade')
    // Two measured days, today, three ahead — same as any other state.
    expect(wrapper.findAll('.wx-day')).toHaveLength(6)
    expect(wrapper.findAll('.wx-day.forecast')).toHaveLength(3)
    // And the 10-day rain, so the "feucht/schlammig" outlook can be checked
    // against what actually fell.
    expect(wrapper.find('.wx-verdict [data-testid="rain-10d"]').text()).toContain('14,5 mm')
  })

  it('keeps the forecast strip in snow and frost too', async () => {
    mockFetch(rawPayload(WINTERBERG, { temperature_2m: -3 }, FORECAST.map((d) => ({ ...d, tempMax: -2 }))))
    const weather = await fetchSpotWeather(51.1927, 8.5236)
    // Frost verdict comes from today's daily high, so make today freezing too.
    weather!.days = weather!.days.map((d) => ({ ...d, tempMax: -2 }))

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    expect(wrapper.text()).toContain('Schnee & Frost')
    expect(wrapper.findAll('.wx-day')).toHaveLength(6)
    expect(wrapper.find('[data-testid="rain-10d"]').text()).toContain('10 Tage')
  })

  it('labels the verdict as calculated, not as a trailcrew statement', async () => {
    mockFetch(rawPayload(WINTERBERG))
    const weather = await fetchSpotWeather(51.1927, 8.5236)

    const wrapper = mount(SpotDetailWeather, { props: { trail, weather, loading: false } })

    expect(wrapper.text()).toContain('keine Trailcrew-Angabe')
  })
})
