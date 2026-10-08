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
    // The real strip, so the teaser looks like what a Supporter user gets.
    expect(sample.findAll('.wx-day')).toHaveLength(6)
  })

  it('offers no rider-feedback scale or link in the teaser — the sample is made up, there is nothing to correct', () => {
    const wrapper = mount(SpotDetailWeatherLocked)

    expect(wrapper.find('[data-testid="soil-feedback-link"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('weißt es besser')
    expect(wrapper.find('.cs').exists()).toBe(false)
  })

  it('hides the sample from assistive technology and from the keyboard — it is decoration, and made up', () => {
    const sample = mount(SpotDetailWeatherLocked).find('.wx-sample-wrap')

    // Otherwise a screen reader would announce "Hero Dirt" as if it were this spot's verdict.
    expect(sample.attributes('aria-hidden')).toBe('true')
    expect(sample.attributes('inert')).toBeDefined()
  })

  it('says in plain readable text that this is a Supporter feature', () => {
    const wrapper = mount(SpotDetailWeatherLocked)
    const overlay = wrapper.find('.wx-lock')

    expect(overlay.exists()).toBe(true)
    // Supporter is derived from the registry, not typed in here.
    expect(overlay.text()).toContain('Supporter')
    // (It used to also say "Beispielansicht"; the wording was shortened on purpose.)
    // The overlay itself is not hidden from anyone.
    expect(overlay.attributes('aria-hidden')).toBeUndefined()
  })

  it('marks the lock with the same SVG padlock as the map\'s radar button, not the 🔒 emoji', () => {
    const icon = mount(SpotDetailWeatherLocked).find('.wx-lock-icon')

    expect(icon.element.tagName.toLowerCase()).toBe('svg')
    expect(icon.attributes('aria-hidden')).toBe('true')
    expect(mount(SpotDetailWeatherLocked).find('.wx-lock').text()).not.toContain('🔒')
  })

  describe('logged out', () => {
    it('leads with the pitch headline and the fuller description, not the plain pill', () => {
      const text = mount(SpotDetailWeatherLocked).find('.wx-lock').text()

      expect(text).toContain('Wie ist der Trail gerade?')
      expect(text).toContain('Bodenzustand, Regen der letzten Tage und Wetter für jeden Spot')
      expect(text).not.toContain('ist eine Supporter-Funktion')
    })

    it('states the eventual price and the Supporter pitch in fine print', () => {
      const text = mount(SpotDetailWeatherLocked).find('.wx-lock').text()

      expect(text).toContain('3 €/Monat')
      expect(text).toContain('25 €/Jahr')
      expect(text).toContain('Mit Supporter Plan unterstützt du')
    })

    it('after the signup promo ended (1.12.2026) still offers sign-up, but no longer promises anything free', () => {
      vi.useFakeTimers({ now: new Date('2026-12-01T09:00:00+01:00') })
      try {
        const cta = mount(SpotDetailWeatherLocked).find('[data-testid="weather-locked-cta"]')
        expect(cta.exists()).toBe(true)
        expect(cta.text()).toBe('Jetzt registrieren')
        expect(mount(SpotDetailWeatherLocked).find('.wx-lock').text()).not.toMatch(/kostenlos|gratis|Danach/)
      } finally {
        vi.useRealTimers()
      }
    })

    it('offers a free trial as a real button, in readable text', () => {
      vi.useFakeTimers({ now: new Date('2026-11-20T12:00:00+01:00') })
      const cta = mount(SpotDetailWeatherLocked).find('[data-testid="weather-locked-cta"]')
      vi.useRealTimers()

      expect(cta.exists()).toBe(true)
      expect(cta.element.tagName).toBe('BUTTON')
      expect(cta.attributes('type')).toBe('button')
      expect(cta.text()).toContain('4 Wochen kostenlos testen')
      // Inside the readable overlay, not the blurred decoration.
      expect(cta.element.closest('[aria-hidden="true"]')).toBeNull()
    })

    it('opens the existing auth modal when clicked', async () => {
      const wrapper = mount(SpotDetailWeatherLocked)
      await wrapper.find('[data-testid="weather-locked-cta"]').trigger('click')

      expect(fakeMapStore.authModalOpen).toBe(true)
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

    it('keeps the plain "ist eine Supporter-Funktion" pill instead of the trial pitch', () => {
      const text = mount(SpotDetailWeatherLocked).find('.wx-lock').text()

      expect(text).toContain('Trail-Zustand ist eine Supporter-Funktion')
      expect(text).not.toContain('Wie ist der Trail gerade?')
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
