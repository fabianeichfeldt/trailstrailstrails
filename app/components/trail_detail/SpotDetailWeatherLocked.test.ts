import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import SpotDetailWeatherLocked from './SpotDetailWeatherLocked.vue'

// Nuxt auto-imports the stores; stub them as the shared-store shapes the card reads.
let fakeAuthStore: { isLoggedIn: boolean }
let fakeMapStore: { authModalOpen: boolean }
vi.stubGlobal('useAuthStore', () => fakeAuthStore)
vi.stubGlobal('useMapStore', () => fakeMapStore)

beforeEach(() => {
  fakeAuthStore = reactive({ isLoggedIn: false })
  fakeMapStore = reactive({ authModalOpen: false })
})

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

  describe('logged out', () => {
    it('offers Plus free for a limited time, as a real button, in readable text', () => {
      const cta = mount(SpotDetailWeatherLocked).find('[data-testid="weather-locked-cta"]')

      expect(cta.exists()).toBe(true)
      expect(cta.element.tagName).toBe('BUTTON')
      expect(cta.attributes('type')).toBe('button')
      expect(cta.text()).toContain('Für begrenzte Zeit kostenlos')
      expect(cta.text()).toContain('jetzt registrieren')
      // Inside the readable overlay, not the blurred decoration.
      expect(cta.element.closest('[aria-hidden="true"]')).toBeNull()
    })

    it('opens the existing auth modal when clicked', async () => {
      const wrapper = mount(SpotDetailWeatherLocked)
      await wrapper.find('[data-testid="weather-locked-cta"]').trigger('click')

      expect(fakeMapStore.authModalOpen).toBe(true)
    })

    it('keeps the "ist eine Plus-Funktion" pill', () => {
      expect(mount(SpotDetailWeatherLocked).find('.wx-lock').text()).toContain('Trail-Zustand ist eine Plus-Funktion')
    })
  })

  describe('logged in but locked', () => {
    beforeEach(() => {
      fakeAuthStore.isLoggedIn = true
    })

    it('does not promise free membership — that is not something they can still get', () => {
      const wrapper = mount(SpotDetailWeatherLocked)

      expect(wrapper.find('[data-testid="weather-locked-cta"]').exists()).toBe(false)
      expect(wrapper.find('.wx-lock').text()).not.toContain('kostenlos')
      expect(wrapper.find('.wx-lock').text()).not.toContain('registrieren')
    })

    it('still says in plain text that this is a Plus feature', () => {
      expect(mount(SpotDetailWeatherLocked).find('.wx-lock').text()).toContain('ist eine Plus-Funktion')
    })
  })

  it('has its own test id, and no REAL weather card — the sample carries a different id', () => {
    const wrapper = mount(SpotDetailWeatherLocked)

    expect(wrapper.find('[data-testid="weather-locked"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="weather-card"]').exists()).toBe(false)
  })

  it('offers no purchase button or link when logged in — there is no billing flow to send anyone to', () => {
    fakeAuthStore.isLoggedIn = true
    const wrapper = mount(SpotDetailWeatherLocked)

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('needs nothing from the network: the sample is built locally, so a locked visitor costs no request', () => {
    const wrapper = mount(SpotDetailWeatherLocked)

    // Rendered synchronously and complete — no skeleton, nothing to wait for.
    expect(wrapper.find('[data-testid="weather-skeleton"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Hero Dirt')
  })

  it('makes no request of any kind', () => {
    const realFetch = globalThis.fetch
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    try {
      mount(SpotDetailWeatherLocked)
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      // Not vi.unstubAllGlobals(): it would also drop the ref/computed stubs from vitest.setup.ts.
      globalThis.fetch = realFetch
    }
  })
})
