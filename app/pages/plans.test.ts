import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, ref } from 'vue'

let authStore: { isLoggedIn: boolean }
let isNative = ref(false)
let mapStore: { authModalOpen: boolean }
const useHead = vi.fn()

vi.stubGlobal('useAuthStore', () => authStore)
vi.stubGlobal('useMapStore', () => mapStore)
vi.stubGlobal('useIsNativeApp', () => isNative)
vi.stubGlobal('useHead', useHead)
vi.stubGlobal('useSeoMeta', vi.fn())
// Minimal stand-in: runs the real handler, so the price really comes through fetch.
vi.stubGlobal('useAsyncData', (_key: string, fn: () => Promise<unknown>) => {
  const data = ref<unknown>(null)
  const refresh = async () => { data.value = await fn() }
  void refresh()
  return { data, refresh }
})

import PlansPage from './plans.vue'

const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  PageHero: { template: '<div><slot /></div>' },
}
const mountPage = async () => {
  const w = mount(PlansPage, { global: { stubs } })
  await flushPromises()
  return w
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  authStore = reactive({ isLoggedIn: false })
  mapStore = reactive({ authModalOpen: false })
  isNative = ref(false)
  fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify([
    { price_monthly_cents: 300, price_yearly_cents: 2500, currency: 'EUR' },
  ]), { status: 200 })))
  vi.stubGlobal('fetch', fetchMock)
  vi.useRealTimers()
})

const supporter = (w: Awaited<ReturnType<typeof mountPage>>) => w.get('[data-testid="plan-supporter"]')
const free = (w: Awaited<ReturnType<typeof mountPage>>) => w.get('[data-testid="plan-free"]')

describe('/plans', () => {
  it('has the page title and a back link to the map', async () => {
    const w = await mountPage()
    expect(w.get('h1').text()).toBe('Preise & Pläne')
    expect(w.find('a.back-link').attributes('href')).toBe('/map')
  })

  it('shows both plans with what each one includes', async () => {
    const w = await mountPage()
    expect(free(w).text()).toContain('Free')
    expect(free(w).text()).toContain('0 €')
    expect(free(w).text()).toContain('Karte')
    expect(supporter(w).text()).toContain('Supporter')
    expect(supporter(w).text()).toContain('Trail-Zustand')
    expect(supporter(w).text()).toContain('Alles aus Free')
  })

  it('shows the live monthly price, and the yearly price with its saving after toggling', async () => {
    const w = await mountPage()
    expect(supporter(w).get('[data-testid="price"]').text()).toMatch(/3,00\s€/)
    expect(supporter(w).text()).toContain('pro Monat')
    await w.get('[data-testid="interval-yearly"]').trigger('click')
    const text = supporter(w).text()
    expect(text).toMatch(/25,00\s€/)
    expect(text).toContain('pro Jahr')
    expect(text).toMatch(/2,08\s€/)
    expect(text).toContain('30 %')
  })

  it('labels prices as gross end prices', async () => {
    expect((await mountPage()).text()).toContain('inkl. MwSt.')
  })

  it('the supporter button is not bookable yet', async () => {
    const btn = supporter(await mountPage()).get('button')
    expect(btn.text()).toBe('Startet in Kürze')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('logged out: the free button opens the signup modal', async () => {
    const w = await mountPage()
    await free(w).get('button').trigger('click')
    expect(mapStore.authModalOpen).toBe(true)
  })

  it('logged in: the free plan links to the map instead', async () => {
    authStore.isLoggedIn = true
    const w = await mountPage()
    expect(free(w).find('button').exists()).toBe(false)
    expect(free(w).get('a').attributes('href')).toBe('/map')
  })

  it('mentions the signup promo only while it runs', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-15T12:00:00+01:00'))
    expect(supporter(await mountPage()).text()).toContain('4 Wochen gratis')
    vi.setSystemTime(new Date('2026-12-01T00:00:01+01:00'))
    expect(supporter(await mountPage()).text()).not.toContain('gratis')
  })

  it('native app: features only — no prices, no buttons, a neutral line instead (store rules)', async () => {
    isNative.value = true
    const w = await mountPage()
    expect(w.text()).toContain('Trail-Zustand')
    expect(w.find('[data-testid="price"]').exists()).toBe(false)
    expect(w.text()).not.toMatch(/\d,\d\d\s€/)
    expect(w.findAll('button').length).toBe(0)
    expect(w.text()).toContain('trailradar.org')
  })

  it('names the conditions and how to reach support (Creem review)', async () => {
    const w = await mountPage()
    const text = w.text()
    expect(text).toContain('Jederzeit kündbar')
    expect(text).toContain('14 Tage Geld-zurück')
    expect(text).toContain('Creem')
    expect(text).toContain('webmaster@trailradar.org')
    const hrefs = w.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/terms#supporter')
    expect(hrefs).toContain('/kontakt')
  })
})
