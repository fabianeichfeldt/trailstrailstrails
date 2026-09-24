import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SpotDetailWeatherLocked from './SpotDetailWeatherLocked.vue'

describe('SpotDetailWeatherLocked', () => {
  it('tells a free user the feature exists and which plan unlocks it', () => {
    const text = mount(SpotDetailWeatherLocked).text()

    expect(text).toContain('Trail-Zustand')
    // Plus is the cheapest plan with the feature — derived from the registry, not typed in here.
    expect(text).toContain('Plus')
  })

  it('has its own test id and shows no weather at all — nothing about the spot leaks through the paywall', () => {
    const wrapper = mount(SpotDetailWeatherLocked)

    expect(wrapper.find('[data-testid="weather-locked"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(false)
    expect(wrapper.findAll('.wx-day')).toHaveLength(0)
    // No temperature, no millimetre figure, no day count — no digits of any kind.
    expect(wrapper.text()).not.toMatch(/\d/)
  })

  it('offers no purchase button yet — there is no billing flow to send anyone to', () => {
    const wrapper = mount(SpotDetailWeatherLocked)

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
