import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SpotDetailWeatherLocked from './SpotDetailWeatherLocked.vue'

describe('SpotDetailWeatherLocked', () => {
  it('shows a blurred sample of the real card — good weather and Hero Dirt — as the teaser', () => {
    const wrapper = mount(SpotDetailWeatherLocked)
    const sample = wrapper.find('.wx-sample-wrap')

    expect(sample.exists()).toBe(true)
    expect(sample.find('[data-testid="weather-sample"]').exists()).toBe(true)
    expect(sample.text()).toContain('Hero Dirt')
    // The real strip, so the teaser looks like what a Plus user gets.
    expect(sample.findAll('.wx-day')).toHaveLength(6)
  })

  it('hides the sample from assistive technology and from the keyboard — it is decoration, and made up', () => {
    const sample = mount(SpotDetailWeatherLocked).find('.wx-sample-wrap')

    // Otherwise a screen reader would announce "Hero Dirt" as if it were this spot's verdict.
    expect(sample.attributes('aria-hidden')).toBe('true')
    expect(sample.attributes('inert')).toBeDefined()
  })

  it('says in plain readable text that this is a Plus feature', () => {
    const wrapper = mount(SpotDetailWeatherLocked)
    const overlay = wrapper.find('.wx-lock')

    expect(overlay.exists()).toBe(true)
    // Plus is derived from the registry, not typed in here.
    expect(overlay.text()).toContain('Plus')
    // (It used to also say "Beispielansicht"; the wording was shortened on purpose.)
    // The overlay itself is not hidden from anyone.
    expect(overlay.attributes('aria-hidden')).toBeUndefined()
  })

  it('has its own test id, and no REAL weather card — the sample carries a different id', () => {
    const wrapper = mount(SpotDetailWeatherLocked)

    expect(wrapper.find('[data-testid="weather-locked"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(false)
  })

  it('offers no purchase button or link yet — there is no billing flow to send anyone to', () => {
    const wrapper = mount(SpotDetailWeatherLocked)

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('needs nothing from the network: the sample is built locally, so a locked visitor costs no Open-Meteo request', () => {
    const wrapper = mount(SpotDetailWeatherLocked)

    // Rendered synchronously and complete — no skeleton, nothing to wait for.
    expect(wrapper.find('[data-testid="weather-skeleton"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Hero Dirt')
  })
})
