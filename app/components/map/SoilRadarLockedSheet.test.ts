import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import SoilRadarLockedSheet from './SoilRadarLockedSheet.vue'

const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const mountSheet = () => mount(SoilRadarLockedSheet, { global: { stubs: { NuxtLink } } })
let fakeAuthStore: { isLoggedIn: boolean }
let fakeMapStore: { authModalOpen: boolean }
vi.stubGlobal('useAuthStore', () => fakeAuthStore)
vi.stubGlobal('useMapStore', () => fakeMapStore)

beforeEach(() => {
  fakeAuthStore = reactive({ isLoggedIn: false })
  fakeMapStore = reactive({ authModalOpen: false })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-10T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('SoilRadarLockedSheet', () => {
  it('explains what the sample showed in the landing page wording, without the removed dryness filter', () => {
    const text = mountSheet().get('.hint').text()
    expect(text).toContain('Das war eine Beispielansicht.')
    expect(text).toContain('Regen der letzten Tage, aktuellem Wetter und Bodenart')
    expect(text).toContain('wo gerade Hero Dirt wartet und wo du im Schlamm stecken bleibst')
    expect(text).not.toContain('Trockenheit')
  })

  it('logged out during the promo: offers free sign-up and opens the auth modal', async () => {
    const w = mountSheet()
    expect(w.text()).toContain('Für begrenzte Zeit kostenlos')
    await w.get('[data-testid="soil-locked-cta"]').trigger('click')
    expect(fakeMapStore.authModalOpen).toBe(true)
  })

  it('logged out after the promo: plain sign-up wording', () => {
    vi.setSystemTime(new Date('2027-01-05T12:00:00Z'))
    const w = mountSheet()
    expect(w.text()).not.toContain('Für begrenzte Zeit')
    expect(w.get('[data-testid="soil-locked-cta"]').text()).toContain('registrieren')
  })

  it('logged in: names it a Supporter feature and links to /plans', () => {
    fakeAuthStore.isLoggedIn = true
    const w = mountSheet()
    expect(w.text()).toContain('Boden-Radar ist eine Supporter-Funktion')
    expect(w.get('a[href="/plans"]').exists()).toBe(true)
    expect(w.find('[data-testid="soil-locked-cta"]').exists()).toBe(false)
  })

  it('emits close from the close button, the backdrop and Escape', async () => {
    const w = mountSheet()
    await w.get('[data-testid="soil-locked-close"]').trigger('click')
    await w.get('.sheet-backdrop').trigger('click')
    await w.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toHaveLength(3)
  })

  it('is a labelled dialog', () => {
    const d = mountSheet().get('[role="dialog"]')
    expect(d.attributes('aria-labelledby')).toBeTruthy()
  })
})
