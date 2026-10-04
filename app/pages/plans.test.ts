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
const free = (w: Page) => w.get('[data-testid="plan-free"]')
const cta = (w: Page) => w.find('[data-testid="supporter-cta"]')

describe('/plans — page', () => {
  it('has the page title and a back link to the map', async () => {
    const w = await mountPage()
    expect(w.get('h1').text()).toBe('Preise & Pläne')
    expect(w.find('a.back-link').attributes('href')).toBe('/map')
  })

  it('shows both plans with what each one includes', async () => {
    const w = await mountPage()
    expect(free(w).text()).toContain('0 €')
    expect(free(w).text()).toContain('Karte')
    expect(supporter(w).text()).toContain('Trail-Zustand')
    expect(supporter(w).text()).toContain('Alles aus Free')
  })

  it('shows the live monthly price, and the yearly price with its saving after toggling', async () => {
    const w = await mountPage()
    expect(supporter(w).get('[data-testid="price"]').text()).toMatch(/3,00\s€/)
    await w.get('[data-testid="interval-yearly"]').trigger('click')
    const text = supporter(w).text()
    expect(text).toMatch(/25,00\s€/)
    expect(text).toMatch(/2,08\s€/)
    expect(text).toContain('30 %')
  })

  it('labels prices as gross end prices', async () => {
    expect((await mountPage()).text()).toContain('inkl. MwSt.')
  })

  it('names the conditions and how to reach support', async () => {
    const w = await mountPage()
    expect(w.text()).toContain('Jederzeit kündbar')
    expect(w.text()).toContain('14 Tage Geld-zurück')
    expect(w.text()).toContain('webmaster@trailradar.org')
    expect(w.findAll('a').map(a => a.attributes('href'))).toContain('/kontakt')
  })

  it('native app: features only — no prices, no buttons, a neutral line instead (store rules)', async () => {
    isNative.value = true
    const w = await mountPage()
    expect(w.text()).toContain('Trail-Zustand')
    expect(w.find('[data-testid="price"]').exists()).toBe(false)
    expect(w.findAll('button').length).toBe(0)
    expect(w.text()).toContain('Supporter kannst du auf trailradar.org abschließen.')
  })
})

describe('/plans — supporter states', () => {
  it('logged out: "Registrieren" opens the auth modal', async () => {
    const w = await mountPage()
    expect(cta(w).text()).toBe('Registrieren')
    await cta(w).trigger('click')
    expect(mapStore.authModalOpen).toBe(true)
  })

  it('logged out: mentions the signup promo only while it runs', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-15T12:00:00+01:00'))
    expect(supporter(await mountPage()).text()).toContain('4 Wochen gratis')
    vi.setSystemTime(new Date('2026-12-01T00:00:01+01:00'))
    expect(supporter(await mountPage()).text()).not.toMatch(/gratis/i)
  })

  it('logged in: the free plan links to the map', async () => {
    authStore.isLoggedIn = true
    const w = await mountPage()
    expect(free(w).find('button').exists()).toBe(false)
    expect(free(w).get('a').attributes('href')).toBe('/map')
  })

  it('subscribed: "Du bist Supporter" with a profile link, no buy button', async () => {
    authStore.isLoggedIn = true
    subStore.subscription = { id: 's1', status: 'active' }
    subStore.eligibility = { eligible: false, reason: 'already_subscribed', eligibleFrom: null }
    const w = await mountPage()
    expect(supporter(w).text()).toContain('Du bist Supporter')
    expect(supporter(w).find('a[href="/profile"]').exists()).toBe(true)
    expect(cta(w).exists()).toBe(false)
  })

  it('grant_active: tells the user until when it is free and from when they can subscribe', async () => {
    authStore.isLoggedIn = true
    subStore.entitlement = { planId: 'supporter', level: 1, discountPercent: 0, earlyAdopterFreeUntil: '2027-03-05T12:00:00Z' }
    subStore.isEarlyAdopter = true
    subStore.eligibility = { eligible: false, reason: 'grant_active', eligibleFrom: '2027-02-19T12:00:00Z' }
    const w = await mountPage()
    expect(supporter(w).text()).toContain('Du hast Trail-Zustand noch gratis bis 5.3.2027. Ab 19.2.2027 kannst du hier Supporter werden.')
    expect(cta(w).exists()).toBe(false)
  })

  it('eligible: plain "Supporter werden"; with a grant still running it says billing starts immediately', async () => {
    authStore.isLoggedIn = true
    expect(cta(await mountPage()).text()).toBe('Supporter werden')
    subStore.isEarlyAdopter = true
    expect(cta(await mountPage()).text()).toBe('Supporter werden — Abrechnung startet sofort')
  })

  it('eligible: the order notice sits above the button and links our terms and Creem\'s buyer terms', async () => {
    authStore.isLoggedIn = true
    const w = await mountPage()
    const notice = w.get('[data-testid="withdrawal-notice"]')
    const links = notice.findAll('a').map(a => a.attributes('href'))
    expect(links).toContain('/terms#supporter')
    expect(links).toContain('https://www.creem.io/buyer-terms')
    expect(notice.text()).toContain('zahlungspflichtig')
    expect(notice.text()).not.toContain('ersten Jahr')
    await w.get('[data-testid="interval-yearly"]').trigger('click')
    expect(w.get('[data-testid="withdrawal-notice"]').text()).toContain('Nach dem ersten Jahr läuft das Abo monatlich weiter')
    const html = w.html()
    expect(html.indexOf('withdrawal-notice')).toBeLessThan(html.indexOf('supporter-cta'))
  })
})

describe('/plans — checkout', () => {
  beforeEach(() => { authStore.isLoggedIn = true })

  it('starts the checkout for the selected interval with the user JWT and goes to Creem', async () => {
    const loc: { href: string } = { href: '' }
    Object.defineProperty(window, 'location', { value: loc, configurable: true })
    const w = await mountPage()
    await w.get('[data-testid="interval-yearly"]').trigger('click')
    await cta(w).trigger('click')
    await flushPromises()
    expect(billingCalls.length).toBe(1)
    expect(billingCalls[0]!.body).toMatchObject({ action: 'checkout', interval: 'yearly' })
    expect(billingCalls[0]!.body.mode).toBeUndefined()
    expect(billingCalls[0]!.headers.Authorization).toBe('Bearer jwt-1')
    expect(loc.href).toBe('https://pay.example/c1')
  })

  it('shows an inline error for already_subscribed', async () => {
    checkoutResponse = { status: 409, body: { error: 'already_subscribed' } }
    const w = await mountPage()
    await cta(w).trigger('click')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('bereits')
  })

  it('shows an inline error for grant_active including the date', async () => {
    checkoutResponse = { status: 409, body: { error: 'grant_active', eligibleFrom: '2027-02-19T12:00:00Z' } }
    const w = await mountPage()
    await cta(w).trigger('click')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('19.2.2027')
  })

  it('shows a generic inline error for anything else', async () => {
    checkoutResponse = { status: 502, body: { error: 'provider_error' } }
    const w = await mountPage()
    await cta(w).trigger('click')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('nicht geklappt')
  })

  it('offers "Testmodus" only to admins and sends mode "test"', async () => {
    expect((await mountPage()).find('[data-testid="test-mode"]').exists()).toBe(false)
    authStore.isAdmin = true
    checkoutResponse = { status: 502, body: { error: 'provider_error' } }
    const w = await mountPage()
    await w.get('[data-testid="test-mode"]').setValue(true)
    await cta(w).trigger('click')
    await flushPromises()
    expect(billingCalls[0]!.body).toMatchObject({ action: 'checkout', interval: 'monthly', mode: 'test' })
  })

  it('keeps the support e-mail out of Cloudflare obfuscation', async () => {
    const html = (await mountPage()).html()
    expect(html).toContain('<!--email_off--><a href="mailto:webmaster@trailradar.org">webmaster@trailradar.org</a><!--email_on-->')
    expect(html.replace(/<!--email_off-->[\s\S]*?<!--email_on-->/g, '')).not.toContain('webmaster@trailradar.org')
  })
})
