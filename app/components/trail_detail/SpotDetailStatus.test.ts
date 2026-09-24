import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { TrailDetails } from '~/types/TrailDetails'
import type { TrailConditionResponse } from '~/types/Weather'
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
 * A view-model whose rain rule says the last measurable rain was `hoursAgo`
 * hours back (null: none in range). Only `rainRule` matters to the banner.
 */
function conditionWithLastRain(hoursAgo: number | null, raining = false): TrailConditionResponse {
  return {
    verdict: { level: 'prime', headline: 'Hero Dirt', detail: '', rain10dMm: 0 },
    rainRule: { raining, hoursSinceRain: hoursAgo },
    current: { temperature: 12, apparentTemperature: 10, icon: '⛅', windKmh: 13 },
    strip: [],
    fetchedAt: '2026-09-24T10:00:00.000Z',
  }
}

describe('SpotDetailStatus — rain rule with the trail condition', () => {
  it('leaves the rule unanswered when no condition is available', () => {
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
        condition: conditionWithLastRain(31),
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
        condition: conditionWithLastRain(5),
      },
    })

    expect(wrapper.find('[data-testid="rain-rule-status"]').text()).toContain('Regel greift')
  })

  it('says "seit Tagen kein Regen" when the function found no rain in range', () => {
    const wrapper = mount(SpotDetailStatus, {
      props: {
        details: details({ status: 'open', rain_policy: 'after', rain_closed_hours: 24 }),
        condition: conditionWithLastRain(null),
      },
    })

    expect(wrapper.find('[data-testid="rain-rule-status"]').text()).toContain('seit Tagen kein Regen')
  })

  it('respects a non-default closure window', () => {
    // 31h of rain-free weather still falls inside a 48h rule.
    const wrapper = mount(SpotDetailStatus, {
      props: {
        details: details({ status: 'open', rain_policy: 'after', rain_closed_hours: 48 }),
        condition: conditionWithLastRain(31),
      },
    })

    expect(wrapper.find('[data-testid="rain-rule-status"]').text()).toContain('Regel greift')
  })

  it('answers a during-rain rule from the current conditions', () => {
    const raining = mount(SpotDetailStatus, {
      props: { details: details({ status: 'open', rain_policy: 'during' }), condition: conditionWithLastRain(1, true) },
    })
    const dry = mount(SpotDetailStatus, {
      props: { details: details({ status: 'open', rain_policy: 'during' }), condition: conditionWithLastRain(40) },
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
        condition: conditionWithLastRain(5),
      },
    })

    const banner = wrapper.find('.spot-status-banner')
    expect(banner.classes()).toContain('ssb-open')
    expect(banner.classes()).not.toContain('ssb-closed')
    expect(banner.find('.ssb-labels strong').text()).toBe('Geöffnet')
  })

  it('adds nothing when the spot has no rain policy at all', () => {
    const wrapper = mount(SpotDetailStatus, {
      props: { details: details({ status: 'open' }), condition: conditionWithLastRain(2) },
    })

    expect(wrapper.find('.ssb-rain').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rain-rule-status"]').exists()).toBe(false)
  })
})
