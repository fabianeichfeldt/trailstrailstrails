import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { TrailDetails } from '~/types/TrailDetails'
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
