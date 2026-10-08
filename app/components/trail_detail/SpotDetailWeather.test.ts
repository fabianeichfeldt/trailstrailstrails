import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import type { ConditionLevel, TrailConditionResponse } from '~/types/Weather'
import SpotDetailWeather from './SpotDetailWeather.vue'
import ConditionScale from './ConditionScale.vue'

// Nuxt auto-imports the stores; stub them as the shared-store shapes the card reads.
let fakeAuthStore: { isLoggedIn: boolean; getToken: () => Promise<string> }
let fakeMapStore: { authModalOpen: boolean }
vi.stubGlobal('useAuthStore', () => fakeAuthStore)
vi.stubGlobal('useMapStore', () => fakeMapStore)

beforeEach(() => {
  fakeAuthStore = reactive({ isLoggedIn: true, getToken: async () => 'jwt' })
  fakeMapStore = reactive({ authModalOpen: false })
})

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
    // range indices on the 5-level scale: 0 dusty, 1 dry, 2 prime, 3 damp, 4 wet.
    verdict: { level: 'damp', headline: 'Feucht, aber gut fahrbar', detail: '1,1 mm in den letzten 3 Tagen.', rain10dMm: 14.5, range: { lo: 2, hi: 3 } },
    rainRule: { raining: false, hoursSinceRain: 30 },
    current: { temperature: 12.4, apparentTemperature: 9.6, icon: '⛅', windKmh: 13.2 },
    strip: [-2, -1, 0, 1, 2, 3].map((o) => day(o, o === -1 ? { precipitationMm: 13.4 } : {})),
    fetchedAt: '2026-09-24T10:00:00.000Z',
    ...overrides,
  }
}

function withLevel(level: ConditionLevel, headline: string, extra: Partial<TrailConditionResponse> = {}) {
  // The server sends no range where there is no soil verdict to put one around.
  const soil = ['dusty', 'dry', 'prime', 'damp', 'wet'].includes(level)
  const range = soil ? { lo: 2 as const, hi: 3 as const } : null
  return condition({ verdict: { level, headline, detail: 'Detail', rain10dMm: 14.5, range }, ...extra })
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
    expect(rainy.text()).toContain('13,4 mm')
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

  it('does not dim or hollow out the forecast bars — riders plan trips around them', () => {
    const source = readFileSync(resolve(__dirname, 'SpotDetailWeather.vue'), 'utf8')
    expect(source).not.toMatch(/\.wx-day\.forecast\s+\.wx-bar/)
  })

  it('fills a forecast day\'s bar exactly like a measured one with the same rain', () => {
    const wrapper = mount(SpotDetailWeather, {
      props: { condition: condition({ strip: [-2, -1, 0, 1, 2, 3].map((o) => day(o, o === 1 ? { precipitationMm: 13.4 } : {})) }), loading: false },
    })

    const forecastRainy = wrapper.findAll('.wx-day')[3]!
    expect(forecastRainy.classes()).toContain('forecast')
    expect(forecastRainy.find('.wx-bar').classes()).toContain('w3')
  })
})

describe('SpotDetailWeather — level badge', () => {
  const COLOURS = { dusty: '#e0a526', dry: '#8bbf3f', prime: '#16c060', damp: '#2ea8e6', wet: '#6d4c41', raining: '#2ea8e6', snow: '#7fa8cf' } as const

  it('draws the map\'s SVG glyph on the map\'s level colour, never an emoji', () => {
    for (const [level, colour] of Object.entries(COLOURS)) {
      const wrapper = mount(SpotDetailWeather, { props: { condition: withLevel(level as ConditionLevel, 'X'), loading: false } })
      const badge = wrapper.find('.wx-badge')

      expect(badge.find('svg').exists(), level).toBe(true)
      expect(badge.text(), level).toBe('')
      expect(badge.attributes('style'), level).toContain(colour)
    }
  })

  it('hard (asphalt): no soil glyph, the badge mirrors the sky', () => {
    const badge = mount(SpotDetailWeather, { props: { condition: withLevel('hard', 'X'), loading: false } }).find('.wx-badge')

    expect(badge.find('svg').exists()).toBe(false)
    expect(badge.text()).toBe('⛅')
  })

  it('wet: the trail-care nudge carries an SVG, not the 🌱 emoji', () => {
    const care = mount(SpotDetailWeather, { props: { condition: withLevel('wet', 'Schlammig'), loading: false } }).find('.wx-care')

    expect(care.find('svg').exists()).toBe(true)
    expect(care.text()).not.toContain('🌱')
  })
})

describe('SpotDetailWeather — levels', () => {
  it('dry: olive badge, no trail-care nudge', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: withLevel('dry', 'Trocken'), loading: false } })

    expect(wrapper.text()).toContain('Trocken')
    expect(wrapper.find('[data-testid="weather-card"]').classes()).toContain('v-dry')
    expect(wrapper.find('.wx-care').exists()).toBe(false)
  })

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
    expect(card.classes().some((c) => ['v-prime', 'v-wet', 'v-damp', 'v-dust', 'v-dry', 'v-snow'].includes(c))).toBe(false)
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

describe('SpotDetailWeather — rider feedback entry', () => {
  const LINK = 'Du bist gerade hier gefahren und weißt es besser?'
  const spot = { spotType: 'trail', spotId: 't1' }
  const link = (w: ReturnType<typeof mount>) => w.find('[data-testid="soil-feedback-link"]')

  it('shows the read-only scale, labelled "Unsere Schätzung", with the model range highlighted', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: condition(), loading: false, ...spot } })
    const scale = wrapper.find('.cs')

    expect(scale.exists()).toBe(true)
    expect(scale.text()).toContain('Unsere Schätzung')
    expect(scale.findAll('button')).toHaveLength(0)
    expect(scale.findAll('.cs-tick').map((s) => s.classes().includes('on'))).toEqual([false, false, true, true, false])
  })

  it('shows the entry link beneath the scale, with exactly the agreed text', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: condition(), loading: false, ...spot } })

    expect(link(wrapper).exists()).toBe(true)
    expect(link(wrapper).text()).toBe(LINK)
    const html = wrapper.html()
    expect(html.indexOf('cs-track')).toBeLessThan(html.indexOf('soil-feedback-link'))
  })

  it.each(['dusty', 'dry', 'prime', 'damp', 'wet'] as const)('is offered for a real %s verdict', (level) => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: withLevel(level, 'x'), loading: false, ...spot } })
    expect(link(wrapper).exists()).toBe(true)
  })

  it.each(['snow', 'raining', 'hard'] as const)('has neither scale nor link for %s', (level) => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: withLevel(level, 'x'), loading: false, ...spot } })
    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(true)
    expect(link(wrapper).exists()).toBe(false)
    expect(wrapper.find('.cs').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(LINK)
  })

  it('has neither for unknown (the card itself is not shown)', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: withLevel('unknown', ''), loading: false, ...spot } })
    expect(link(wrapper).exists()).toBe(false)
    expect(wrapper.find('.cs').exists()).toBe(false)
  })

  it('has neither when a soil level arrives without a range (backend not deployed yet)', () => {
    const c = condition()
    delete (c.verdict as { range?: unknown }).range
    const wrapper = mount(SpotDetailWeather, { props: { condition: c, loading: false, ...spot } })
    expect(link(wrapper).exists()).toBe(false)
    expect(wrapper.find('.cs').exists()).toBe(false)
  })

  it('has neither in the locked teaser sample', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: condition(), loading: false, sample: true, ...spot } })
    expect(link(wrapper).exists()).toBe(false)
    expect(wrapper.find('.cs').exists()).toBe(false)
  })

  it('has neither without a spot to report on', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: condition(), loading: false } })
    expect(link(wrapper).exists()).toBe(false)
  })

  it('passes the continuous positionRange through to the read-only ConditionScale', () => {
    const c = condition({ verdict: { ...condition().verdict, positionRange: { lo: 1.4, hi: 2.6 } } })
    const wrapper = mount(SpotDetailWeather, { props: { condition: c, loading: false, ...spot } })

    expect(wrapper.findComponent(ConditionScale).props('positionRange')).toEqual({ lo: 1.4, hi: 2.6 })
  })

  it('keeps working when positionRange is absent from the wire payload (optional field)', () => {
    const wrapper = mount(SpotDetailWeather, { props: { condition: condition(), loading: false, ...spot } })

    expect(wrapper.findComponent(ConditionScale).props('positionRange')).toBeNull()
  })

  it('opens the feedback sheet for a logged-in rider', async () => {
    const wrapper = mount(SpotDetailWeather, {
      props: { condition: condition(), loading: false, ...spot },
      global: { stubs: { teleport: true } },
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await link(wrapper).trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    await wrapper.find('[data-testid="soil-close"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('sends a logged-out visitor to the login flow instead of opening the sheet', async () => {
    fakeAuthStore.isLoggedIn = false
    const wrapper = mount(SpotDetailWeather, {
      props: { condition: condition(), loading: false, ...spot },
      global: { stubs: { teleport: true } },
    })

    await link(wrapper).trigger('click')
    expect(fakeMapStore.authModalOpen).toBe(true)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})
