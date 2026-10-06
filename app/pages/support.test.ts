import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, ref } from 'vue'

let authStore: { isLoggedIn: boolean; isAdmin: boolean; getToken: () => Promise<string> }
let mapStore: { authModalOpen: boolean }
let subStore: any
let isNative = ref(false)
const useHead = vi.fn()

vi.stubGlobal('useAuthStore', () => authStore)
vi.stubGlobal('useMapStore', () => mapStore)
vi.stubGlobal('useSubscriptionStore', () => subStore)
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

import SupportPage from './support.vue'

const stubs = {
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  PageHero: { template: '<div><slot /></div>' },
}
const mountPage = async () => {
  const w = mount(SupportPage, { global: { stubs } })
  await flushPromises()
  return w
}
type Page = Awaited<ReturnType<typeof mountPage>>

const PRICES = [{ price_monthly_cents: 300, price_yearly_cents: 2500, currency: 'EUR' }]
let checkoutResponse: { status: number; body: unknown }
let billingCalls: Array<{ headers: Record<string, string>; body: Record<string, unknown> }>

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }))

beforeEach(() => {
  authStore = reactive({ isLoggedIn: false, isAdmin: false, getToken: async () => 'jwt-1' })
  mapStore = reactive({ authModalOpen: false })
  subStore = reactive({
    loaded: true,
    entitlement: { planId: 'free', level: 0, discountPercent: 0, earlyAdopterFreeUntil: null },
    subscription: null,
    eligibility: { eligible: true, reason: null, eligibleFrom: null },
    isEarlyAdopter: false,
    crewRole: null,
    canBuy: (native: boolean) => authStore.isLoggedIn && !native && subStore.eligibility?.eligible === true,
  })
  isNative = ref(false)
  checkoutResponse = { status: 200, body: { checkoutUrl: 'https://pay.example/c1' } }
  billingCalls = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string, init: RequestInit) => {
    if (url.includes('/rest/v1/subscription_plans')) return json(200, PRICES)
    if (url.includes('/functions/v1/billing')) {
      billingCalls.push({ headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) })
      return json(checkoutResponse.status, checkoutResponse.body)
    }
    return json(404, {})
  }))
  vi.useRealTimers()
})

const supporter = (w: Page) => w.get('[data-testid="plan-supporter"]')
const cta = (w: Page) => w.find('[data-testid="supporter-cta"]')

describe('/support — page', () => {
  it('tells the side-project story', async () => {
    const text = (await mountPage()).text()
    expect(text).toContain('Feierabendprojekt')
    expect(text).toContain('Vollzeitjob')
    expect(text).toContain('Bärenleite')
  })

  it('lists what the contribution is for', async () => {
    const text = (await mountPage()).text()
    expect(text).toContain('Server und Datenbank')
    expect(text).toContain('Wetter- und Bodendaten')
    expect(text).toContain('App Stores und die Domain')
    expect(text).toContain('Abende nach Feierabend')
  })

  it('never mentions PayPal or the sticker', async () => {
    const html = (await mountPage()).html()
    expect(html).not.toContain('PayPal')
    expect(html).not.toContain('paypal.me')
    expect(html).not.toContain('Sticker')
  })

  it('renders the shared plan cards with the live price', async () => {
    const w = await mountPage()
    expect(w.find('[data-testid="plan-free"]').exists()).toBe(true)
    expect(w.find('[data-testid="plan-supporter"]').exists()).toBe(true)
    expect(supporter(w).get('[data-testid="price"]').text()).toMatch(/3,00\s€/)
  })

  it('links to /plans for all the details, hidden in native', async () => {
    const w = await mountPage()
    const details = w.get('.plans-details')
    expect(details.text()).toContain('alle Details')
    expect(details.get('a').attributes('href')).toBe('/plans')

    isNative.value = true
    const native = await mountPage()
    expect(native.find('.plans-details').exists()).toBe(false)
  })

  it('native app: no prices, no checkout button', async () => {
    isNative.value = true
    const w = await mountPage()
    expect(w.find('[data-testid="price"]').exists()).toBe(false)
    expect(w.find('[data-testid="supporter-cta"]').exists()).toBe(false)
  })

  it('shows the free ways to help, and a back link to the map', async () => {
    const w = await mountPage()
    expect(w.text()).toContain('Auch ohne Geld kannst du viel bewegen')
    expect(w.text()).toContain('Trails eintragen')
    expect(w.text()).toContain('Fehler melden')
    expect(w.text()).toContain('Teilen')
    expect(w.find('a.back-link').attributes('href')).toBe('/map')
  })
})

describe('/support — checkout', () => {
  beforeEach(() => { authStore.isLoggedIn = true })

  it('starts the checkout with the user JWT and goes to Creem', async () => {
    const loc: { href: string } = { href: '' }
    Object.defineProperty(window, 'location', { value: loc, configurable: true })
    const w = await mountPage()
    await cta(w).trigger('click')
    await flushPromises()
    expect(billingCalls.length).toBe(1)
    expect(billingCalls[0]!.headers.Authorization).toBe('Bearer jwt-1')
    expect(loc.href).toBe('https://pay.example/c1')
  })
})
