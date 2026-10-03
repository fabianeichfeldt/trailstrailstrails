import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, ref } from 'vue'

vi.mock('~/communication/billing', () => ({
  getSupporterPrices: vi.fn(),
  startCheckout: vi.fn(),
}))
import { getSupporterPrices, startCheckout } from '~/communication/billing'
import SupporterPage from './index.vue'

let authStore: any
let mapStore: any
let subStore: any
let isNative = ref(false)
let pricesData = ref<any>(null)
const refresh = vi.fn()
const useHead = vi.fn()

vi.stubGlobal('useAuthStore', () => authStore)
vi.stubGlobal('useMapStore', () => mapStore)
vi.stubGlobal('useSubscriptionStore', () => subStore)
vi.stubGlobal('useIsNativeApp', () => isNative)
vi.stubGlobal('useHead', useHead)
vi.stubGlobal('useAsyncData', () => ({ data: pricesData, refresh }))

const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const PageHero = { template: '<div><slot /></div>' }
const PRICES = { monthlyCents: 299, yearlyCents: 2400, currency: 'EUR' }

function mountPage() {
  return mount(SupporterPage, { global: { stubs: { NuxtLink, PageHero } } })
}
const ctaButton = (w: any) => w.find('[data-testid="supporter-cta"]')

beforeEach(() => {
  authStore = reactive({ isLoggedIn: true, isAdmin: false, getToken: async () => 'jwt-1' })
  mapStore = reactive({ authModalOpen: false })
  subStore = reactive({
    loaded: true,
    entitlement: { planId: 'free', level: 0, discountPercent: 0, earlyAdopterFreeUntil: null },
    subscription: null,
    eligibility: { eligible: true, reason: null, eligibleFrom: null },
    isEarlyAdopter: false,
    canBuy: (native: boolean) => authStore.isLoggedIn && !native && subStore.eligibility?.eligible === true,
  })
  isNative = ref(false)
  pricesData = ref(PRICES)
  refresh.mockReset()
  useHead.mockReset()
  vi.mocked(startCheckout).mockReset()
  vi.mocked(getSupporterPrices).mockReset()
})

describe('/supporter page', () => {
  it('has the back link, the page title and names the Trail-Zustand benefit', () => {
    const w = mountPage()
    expect(w.find('a.back-link').attributes('href')).toBe('/map')
    expect(w.find('a.back-link').text()).toBe('← Zurück zur Karte')
    expect(useHead).toHaveBeenCalledWith(expect.objectContaining({ title: 'Supporter werden – Trailradar' }))
    expect(w.text()).toContain('Trail-Zustand')
  })

  it('refreshes the prices on mount', async () => {
    mountPage()
    await flushPromises()
    expect(refresh).toHaveBeenCalled()
  })

  it('toggles monthly/yearly and shows the effective monthly price for yearly', async () => {
    const w = mountPage()
    expect(w.find('[data-testid="price"]').text()).toContain('2,99')
    await w.find('[data-testid="interval-yearly"]').trigger('click')
    const price = w.find('[data-testid="price"]').text()
    expect(price).toContain('2,00')
    expect(price).toContain('24,00')
  })

  it('hides prices gracefully when they could not be loaded', () => {
    pricesData.value = null
    const w = mountPage()
    expect(w.find('[data-testid="price"]').exists()).toBe(false)
    expect(ctaButton(w).exists()).toBe(true)
  })

  it('logged out: "Registrieren" opens the auth modal', async () => {
    authStore.isLoggedIn = false
    const w = mountPage()
    expect(ctaButton(w).text()).toBe('Registrieren')
    await ctaButton(w).trigger('click')
    expect(mapStore.authModalOpen).toBe(true)
  })

  it('grant_active: tells the user until when it is free and from when they can subscribe', () => {
    subStore.entitlement = { planId: 'supporter', level: 1, discountPercent: 0, earlyAdopterFreeUntil: '2027-03-05T12:00:00Z' }
    subStore.isEarlyAdopter = true
    subStore.eligibility = { eligible: false, reason: 'grant_active', eligibleFrom: '2027-02-19T12:00:00Z' }
    const w = mountPage()
    expect(w.text()).toContain('Du hast Trail-Zustand noch gratis bis 5.3.2027. Ab 19.2.2027 kannst du hier Supporter werden.')
    expect(w.find('[data-testid="supporter-cta"]').exists()).toBe(false)
  })

  it('eligible with a grant still running: says billing starts immediately', () => {
    subStore.entitlement = { planId: 'supporter', level: 1, discountPercent: 0, earlyAdopterFreeUntil: '2026-10-10T12:00:00Z' }
    subStore.isEarlyAdopter = true
    const w = mountPage()
    expect(ctaButton(w).text()).toBe('Supporter werden — Abrechnung startet sofort')
  })

  it('eligible: plain "Supporter werden"', () => {
    expect(ctaButton(mountPage()).text()).toBe('Supporter werden')
  })

  it('subscribed: "Du bist Supporter" with a profile link, no buy button', () => {
    subStore.subscription = { id: 's1', status: 'active' }
    subStore.eligibility = { eligible: false, reason: 'already_subscribed', eligibleFrom: null }
    const w = mountPage()
    expect(w.text()).toContain('Du bist Supporter')
    expect(w.find('a[href="/profile"]').exists()).toBe(true)
    expect(w.find('[data-testid="supporter-cta"]').exists()).toBe(false)
  })

  it('native: neutral text, no button, no price', () => {
    isNative.value = true
    const w = mountPage()
    expect(w.text()).toContain('Supporter kannst du auf trailradar.org abschließen.')
    expect(w.find('[data-testid="supporter-cta"]').exists()).toBe(false)
    expect(w.find('[data-testid="price"]').exists()).toBe(false)
  })

  it('shows the withdrawal notice (marked for legal review) above the buy button', () => {
    const w = mountPage()
    const notice = w.find('[data-testid="withdrawal-notice"]')
    expect(notice.exists()).toBe(true)
    const html = w.html()
    expect(html.indexOf('withdrawal-notice')).toBeLessThan(html.indexOf('supporter-cta'))
  })

  it('click starts the checkout with the selected interval and redirects to the checkout url', async () => {
    vi.mocked(startCheckout).mockResolvedValue({ ok: true, checkoutUrl: 'https://pay.example/c1' })
    const loc: any = { href: '' }
    Object.defineProperty(window, 'location', { value: loc, configurable: true })
    const w = mountPage()
    await w.find('[data-testid="interval-yearly"]').trigger('click')
    await ctaButton(w).trigger('click')
    await flushPromises()
    expect(startCheckout).toHaveBeenCalledWith('jwt-1', 'yearly', undefined)
    expect(loc.href).toBe('https://pay.example/c1')
  })

  it('shows an inline error for already_subscribed', async () => {
    vi.mocked(startCheckout).mockResolvedValue({ ok: false, error: 'already_subscribed' })
    const w = mountPage()
    await ctaButton(w).trigger('click')
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain('bereits')
  })

  it('shows an inline error for grant_active including the date', async () => {
    vi.mocked(startCheckout).mockResolvedValue({ ok: false, error: 'grant_active', eligibleFrom: '2027-02-19T12:00:00Z' })
    const w = mountPage()
    await ctaButton(w).trigger('click')
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain('19.2.2027')
  })

  it('shows a generic inline error for unknown failures', async () => {
    vi.mocked(startCheckout).mockResolvedValue({ ok: false, error: 'unknown' })
    const w = mountPage()
    await ctaButton(w).trigger('click')
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toContain('nicht geklappt')
  })

  it('offers the "Testmodus" checkbox only to admins and passes mode "test"', async () => {
    expect(mountPage().find('[data-testid="test-mode"]').exists()).toBe(false)
    authStore.isAdmin = true
    vi.mocked(startCheckout).mockResolvedValue({ ok: false, error: 'unknown' })
    const w = mountPage()
    await w.find('[data-testid="test-mode"]').setValue(true)
    await ctaButton(w).trigger('click')
    await flushPromises()
    expect(startCheckout).toHaveBeenCalledWith('jwt-1', 'monthly', 'test')
  })
})
