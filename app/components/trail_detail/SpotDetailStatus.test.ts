import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { TrailDetails } from '~/types/TrailDetails'
import type { SpotWeather } from '~/types/Weather'
import SpotDetailStatus from './SpotDetailStatus.vue'

// Split out of SpotDetailInfo.test.ts as part of splitting the former
// monolithic SpotDetailInfo.vue into per-section components — the status
// banner now sits directly under the hero (SpotDetailHero), before the
// Photos section, instead of inside the description card.
function details(overrides: Partial<TrailDetails> = {}): TrailDetails {
  const d = new TrailDetails('t1')
  Object.assign(d, overrides)
  return d
}

describe('SpotDetailStatus', () => {
  it('renders nothing when the spot has no status field at all', () => {
    const wrapper = mount(SpotDetailStatus, { props: { details: details() } })
    expect(wrapper.find('.spot-status-banner').exists()).toBe(false)
  })

  it('renders the status banner for a closed spot with a hint', () => {
    const wrapper = mount(SpotDetailStatus, {
      props: { details: details({ status: 'closed', status_hint: 'Wegen Bauarbeiten gesperrt' }) },
    })

    const banner = wrapper.find('.spot-status-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.classes()).toContain('ssb-closed')
    expect(banner.text()).toContain('Geschlossen')
    expect(banner.text()).toContain('Wegen Bauarbeiten gesperrt')
  })

  it('shows a donation CTA when a donation_url is set and access is free', () => {
    const wrapper = mount(SpotDetailStatus, {
      props: { details: details({ status: 'open', donation_url: 'https://example.com/donate' }) },
    })

    const donate = wrapper.find('.ssb-donate-cta')
    expect(donate.exists()).toBe(true)
    expect(donate.attributes('href')).toBe('https://example.com/donate')
  })

  it('shows a rain-policy hint for an open spot that closes during rain', () => {
    const wrapper = mount(SpotDetailStatus, {
      props: { details: details({ status: 'open', rain_policy: 'during' }) },
    })

    expect(wrapper.find('.ssb-rain').text()).toContain('Geschlossen bei Regen')
  })
})

// ── Rain rule, answered with live weather ────────────────────────────────
// The trailcrew records the rule ("closed 24h after rain"); weather data
// finishes the sentence ("last rain 31h ago"). Strictly advisory — the
// banner's own status must never move because of it.

/**
 * Builds a payload whose last measurable rain is `hoursAgo` hours back.
 * Hour stamps are UTC with a zero offset, matching what Open-Meteo returns
 * for a spot in UTC.
 */
function weatherWithLastRain(hoursAgo: number | null, currentPrecipMm = 0): SpotWeather {
  const nowMs = Date.now()
  const time: string[] = []
  const precipitationMm: number[] = []
  const snowfallCm: number[] = []

  for (let i = 120; i >= 1; i--) {
    time.push(new Date(nowMs - i * 3600_000).toISOString().slice(0, 13) + ':00')
    precipitationMm.push(hoursAgo !== null && i === hoursAgo ? 2.4 : 0)
    snowfallCm.push(0)
  }

  const today = new Date(nowMs).toISOString().slice(0, 10)
  return {
    current: {
      temperature: 12,
      apparentTemperature: 10,
      weatherCode: currentPrecipMm > 0 ? 63 : 2,
      precipitationMm: currentPrecipMm,
      windKmh: 13,
    },
    days: [{ date: today, weatherCode: 2, precipitationMm: 0, snowfallCm: 0, tempMax: 18, tempMin: 9, et0Mm: 2 }],
    hourly: { time, precipitationMm, snowfallCm },
    utcOffsetSeconds: 0,
    timezone: 'UTC',
    elevation: 500,
  }
}

describe('SpotDetailStatus — rain rule with weather', () => {
  it('leaves the rule unanswered when no weather is available', () => {
    const wrapper = mount(SpotDetailStatus, {
      props: { details: details({ status: 'open', rain_policy: 'after', rain_closed_hours: 24 }) },
    })

    expect(wrapper.find('.ssb-rain').text()).toContain('Geschlossen 24h nach Regen')
    expect(wrapper.find('[data-testid="rain-rule-status"]').exists()).toBe(false)
  })

  it('reports that the rule no longer bites once the window has passed', () => {
    const wrapper = mount(SpotDetailStatus, {
      props: {
        details: details({ status: 'open', rain_policy: 'after', rain_closed_hours: 24 }),
        weather: weatherWithLastRain(31),
      },
    })

    const calc = wrapper.find('[data-testid="rain-rule-status"]').text()
    expect(calc).toMatch(/letzter Regen vor 3[12] h/)
    expect(calc).not.toContain('Regel greift')
  })

  it('reports that the rule is in force when the rain is recent', () => {
    const wrapper = mount(SpotDetailStatus, {
      props: {
        details: details({ status: 'open', rain_policy: 'after', rain_closed_hours: 24 }),
        weather: weatherWithLastRain(5),
      },
    })

    expect(wrapper.find('[data-testid="rain-rule-status"]').text()).toContain('Regel greift')
  })

  it('respects a non-default closure window', () => {
    // 31h of rain-free weather still falls inside a 48h rule.
    const wrapper = mount(SpotDetailStatus, {
      props: {
        details: details({ status: 'open', rain_policy: 'after', rain_closed_hours: 48 }),
        weather: weatherWithLastRain(31),
      },
    })

    expect(wrapper.find('[data-testid="rain-rule-status"]').text()).toContain('Regel greift')
  })

  it('answers a during-rain rule from the current conditions', () => {
    const raining = mount(SpotDetailStatus, {
      props: { details: details({ status: 'open', rain_policy: 'during' }), weather: weatherWithLastRain(1, 0.4) },
    })
    const dry = mount(SpotDetailStatus, {
      props: { details: details({ status: 'open', rain_policy: 'during' }), weather: weatherWithLastRain(40) },
    })

    expect(raining.find('[data-testid="rain-rule-status"]').text()).toContain('es regnet gerade')
    expect(dry.find('[data-testid="rain-rule-status"]').text()).toContain('aktuell kein Regen')
  })

  it('never changes the official status — weather is advisory only', () => {
    // Rain five hours ago with a 24h rule: the annotation says the rule is in
    // force, but only the trailcrew may actually close a spot.
    const wrapper = mount(SpotDetailStatus, {
      props: {
        details: details({ status: 'open', rain_policy: 'after', rain_closed_hours: 24 }),
        weather: weatherWithLastRain(5),
      },
    })

    const banner = wrapper.find('.spot-status-banner')
    expect(banner.classes()).toContain('ssb-open')
    expect(banner.classes()).not.toContain('ssb-closed')
    expect(banner.find('.ssb-labels strong').text()).toBe('Geöffnet')
  })

  it('adds nothing when the spot has no rain policy at all', () => {
    const wrapper = mount(SpotDetailStatus, {
      props: { details: details({ status: 'open' }), weather: weatherWithLastRain(2) },
    })

    expect(wrapper.find('.ssb-rain').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rain-rule-status"]').exists()).toBe(false)
  })
})
