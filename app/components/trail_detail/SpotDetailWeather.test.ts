import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import type { ConditionLevel, TrailConditionResponse } from '~/types/Weather'
import SpotDetailWeather from './SpotDetailWeather.vue'

// The card renders a finished view-model from the trail-condition function; the
// model itself (levels, thresholds, headlines) lives server-side and is tested
// there. These tests cover what the card does with the contract.

type StripDay = TrailConditionResponse['strip'][number]

function day(offset: number, overrides: Partial<StripDay> = {}): StripDay {
  const names = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  return {
    date: `2026-09-${String(22 + offset).padStart(2, '0')}`,
    weekday: names[offset + 2]!,
    icon: '⛅',
    precipitationMm: 0,
    isToday: offset === 0,
    isForecast: offset > 0,
    ...overrides,
  }
}

function condition(overrides: Partial<TrailConditionResponse> = {}): TrailConditionResponse {
  return {
    verdict: { level: 'damp', headline: 'Feucht, aber gut fahrbar', detail: '1,1 mm in den letzten 3 Tagen.', rain10dMm: 14.5 },
    rainRule: { raining: false, hoursSinceRain: 30 },
    current: { temperature: 12.4, apparentTemperature: 9.6, icon: '⛅', windKmh: 13.2 },
    strip: [-2, -1, 0, 1, 2, 3].map((o) => day(o, o === -1 ? { precipitationMm: 13.4 } : {})),
    fetchedAt: '2026-09-24T10:00:00.000Z',
    ...overrides,
  }
}

function withLevel(level: ConditionLevel, headline: string, extra: Partial<TrailConditionResponse> = {}) {
  return condition({ verdict: { level, headline, detail: 'Detail', rain10dMm: 14.5 }, ...extra })
}

describe('SpotDetailWeather — rendering the view-model', () => {
  it('shows verdict, current conditions and the calculated-note in a real card', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: condition(), loading: false } })
    const text = wrapper.text()

    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(true)
    expect(text).toContain('Trail-Zustand')
    expect(text).toContain('Feucht, aber gut fahrbar')
    expect(text).toContain('12°')
    expect(text).toContain('gefühlt 10°')
    expect(text).toContain('13 km/h')
    expect(text).toContain('keine Trailcrew-Angabe')
  })

  it('draws the strip as given: two past days, today, three ahead — today labelled "Heute"', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: condition(), loading: false } })

    const columns = wrapper.findAll('.wx-day')
    expect(columns).toHaveLength(6)
    expect(columns[2]!.classes()).toContain('today')
    expect(columns[2]!.text()).toContain('Heute')
    expect(columns[0]!.text()).toContain('Mo')
    expect(columns[3]!.text()).toContain('Do')
    expect(wrapper.findAll('.wx-day.forecast')).toHaveLength(3)
    for (const measured of columns.slice(0, 3)) expect(measured.classes()).not.toContain('forecast')
  })

  it('formats the rain per day and scales the bars', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: condition(), loading: false } })

    const rainy = wrapper.findAll('.wx-day')[1]!
    expect(rainy.text()).toContain('13,4')
    expect(rainy.find('.wx-bar').classes()).toContain('w3')
    const dry = wrapper.findAll('.wx-day')[0]!
    expect(dry.text()).toContain('0 mm')
    expect(dry.find('.wx-bar').attributes('style')).toContain('height: 3px')
  })

  it('states how much rain fell over the last 10 days, right under the verdict and above the strip', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: condition(), loading: false } })

    const total = wrapper.find('.wx-verdict [data-testid="rain-10d"]')
    expect(total.exists()).toBe(true)
    expect(total.text()).toContain('10 Tage')
    expect(total.text()).toContain('14,5 mm')
    const html = wrapper.html()
    expect(html.indexOf('data-testid="rain-10d"')).toBeLessThan(html.indexOf('class="wx-strip"'))
  })

  it('credits Open-Meteo with a link, on the same row as the "calculated" note', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: condition(), loading: false } })

    // Attribution is a condition of Open-Meteo's terms, so it stays on the card.
    const foot = wrapper.find('.wx-foot')
    expect(foot.text()).toContain('Berechnete Angabe')
    const link = foot.find('a')
    expect(link.text()).toContain('Open-Meteo')
    expect(link.attributes('href')).toBe('https://open-meteo.com/')
    expect(link.attributes('rel')).toContain('noopener')
    expect(link.attributes('target')).toBe('_blank')
  })

  it('as a sample: is marked as one, and credits nobody for data that is made up', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: condition(), loading: false, sample: true } })

    expect(wrapper.find('[data-testid="weather-sample"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(false)
    expect(wrapper.find('.wx-foot a').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Open-Meteo')
    expect(wrapper.findAll('.wx-day')).toHaveLength(6)
  })

  it('draws the weather icons big enough to read on a desktop screen', () => {
    const source = readFileSync(resolve(__dirname, 'SpotDetailWeather.vue'), 'utf8')
    const size = (selector: string): number => {
      const rule = source.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))
      const px = rule?.[1]?.match(/font-size:\s*(\d+)px/)
      return px ? Number(px[1]) : 0
    }

    expect(size('.wx-day-icon')).toBeGreaterThanOrEqual(24)
    expect(size('.wx-now-icon')).toBeGreaterThanOrEqual(26)
  })

  it('does not dim the forecast days — riders plan trips around them', () => {
    const source = readFileSync(resolve(__dirname, 'SpotDetailWeather.vue'), 'utf8')
    const rules = [...source.matchAll(/([^{}]*\.wx-day\.forecast[^{}]*)\{([^}]*)\}/g)]

    expect(rules.length).toBeGreaterThan(0)
    for (const [, , body] of rules) expect(body).not.toMatch(/opacity|filter\s*:/)
  })
})

describe('SpotDetailWeather — levels', () => {
  it('prime: green card, no trail-care nudge', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: withLevel('prime', 'Hero Dirt'), loading: false } })

    expect(wrapper.text()).toContain('Hero Dirt')
    expect(wrapper.find('[data-testid="weather-card"]').classes()).toContain('v-prime')
    expect(wrapper.find('.wx-care').exists()).toBe(false)
  })

  it('wet: red card with the "Trails schonen" nudge', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: withLevel('wet', 'Schlammig'), loading: false } })

    expect(wrapper.text()).toContain('Schlammig')
    expect(wrapper.text()).toContain('Trails schonen')
    expect(wrapper.find('.wx-care').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weather-card"]').classes()).toContain('v-wet')
  })

  it('hard (asphalt): no verdict colour, but the strip and the 10-day rain stay', () => {
    const wrapper = mount(SpotDetailWeather, {
      props: { condition: withLevel('hard', '12°, teilweise bewölkt'), loading: false },
    })
    const card = wrapper.find('[data-testid="weather-card"]')

    expect(card.classes()).toContain('v-plain')
    expect(card.classes().some((c) => ['v-prime', 'v-wet', 'v-damp', 'v-dust', 'v-snow'].includes(c))).toBe(false)
    expect(wrapper.text()).not.toContain('Berechnete Angabe')
    expect(wrapper.findAll('.wx-day')).toHaveLength(6)
    expect(wrapper.find('[data-testid="rain-10d"]').text()).toContain('14,5 mm')
  })

  it('raining and snow keep the forecast strip — "when does it stop" is the question', () => {
    for (const level of ['raining', 'snow'] as const) {
      const wrapper = mount(SpotDetailWeather, { props: { condition: withLevel(level, 'Etwas'), loading: false } })

      expect(wrapper.findAll('.wx-day')).toHaveLength(6)
      expect(wrapper.findAll('.wx-day.forecast')).toHaveLength(3)
      expect(wrapper.find('[data-testid="rain-10d"]').text()).toContain('10 Tage')
    }
  })

  it('unknown: renders nothing at all', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: withLevel('unknown', ''), loading: false } })

    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('renders nothing when there is no condition (function unreachable)', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: null, loading: false } })

    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('renders a skeleton while loading, never a verdict', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: null, loading: true } })

    expect(wrapper.find('[data-testid="weather-skeleton"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Hero Dirt')
  })
})
