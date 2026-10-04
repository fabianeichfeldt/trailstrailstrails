import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive, ref } from 'vue'

vi.mock('~/communication/billing', () => ({
  openPortal: vi.fn(),
  resumeSubscription: vi.fn(),
}))
import { openPortal, resumeSubscription } from '~/communication/billing'
import PlanCard from './PlanCard.vue'

let store: any
let isNative = ref(false)
vi.stubGlobal('useSubscriptionStore', () => store)
vi.stubGlobal('useAuthStore', () => ({ isLoggedIn: true, getToken: async () => 'jwt-1' }))
vi.stubGlobal('useIsNativeApp', () => isNative)

const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function makeStore(over: any = {}) {
  const s: any = reactive({
    entitlement: { planId: 'free', level: 0, discountPercent: 0, earlyAdopterFreeUntil: null },
    subscription: null,
    isCancelScheduled: false,
    isPastDue: false,
    isEarlyAdopter: false,
    _eligible: false,
    canBuy: (native: boolean) => !native && s._eligible,
    load: vi.fn().mockResolvedValue(undefined),
    ...over,
  })
  return s
}
const sub = (o: any = {}) => ({
  id: 's1', planId: 'supporter', provider: 'creem', status: 'active',
  currentPeriodEnd: '2026-12-24T00:00:00Z', cancelAtPeriodEnd: false, hasCustomer: true,
  customerEmail: 'a@b.de', createdAt: '2026-10-01T00:00:00Z', ...o,
})
const supporterEnt = { planId: 'supporter', level: 1, discountPercent: 0, earlyAdopterFreeUntil: null }
const mountCard = () => mount(PlanCard, { global: { stubs: { NuxtLink } } })

beforeEach(() => {
  isNative = ref(false)
  store = makeStore()
  vi.mocked(openPortal).mockReset()
  vi.mocked(resumeSubscription).mockReset()
})

describe('PlanCard', () => {
  it('free without grant: shows the free plan, a buy link when eligible, no portal button', () => {
    store._eligible = true
    const w = mountCard()
    expect(w.text()).toContain('Kostenlos')
    expect(w.find('a[href="/plans"]').exists()).toBe(true)
    expect(w.text()).not.toContain('Abo verwalten')
  })

  it('grant running (>14 d): shows "Gratis bis" in de-DE and no buy link', () => {
    store.entitlement = { planId: 'supporter', level: 1, discountPercent: 0, earlyAdopterFreeUntil: '2027-03-05T12:00:00Z' }
    store.isEarlyAdopter = true
    const w = mountCard()
    expect(w.text()).toContain('Gratis bis 5.3.2027')
    expect(w.find('a[href="/plans"]').exists()).toBe(false)
  })

  it('grant ending within 14 d: shows the countdown and the buy link', () => {
    store.entitlement = { planId: 'supporter', level: 1, discountPercent: 0, earlyAdopterFreeUntil: '2026-10-10T12:00:00Z' }
    store.isEarlyAdopter = true
    store._eligible = true
    const w = mountCard()
    expect(w.text()).toContain('Gratis bis 10.10.2026')
    expect(w.find('a[href="/plans"]').exists()).toBe(true)
  })

  it('active: shows plan name and "verlängert sich am"', () => {
    store.entitlement = supporterEnt
    store.subscription = sub()
    const w = mountCard()
    expect(w.text()).toContain('Supporter')
    expect(w.text()).toContain('verlängert sich am 24.12.2026')
    expect(w.text()).toContain('Abo verwalten')
    expect(w.find('a.plan-cancel[href="/kuendigen"]').text()).toContain('Kündigen')
  })

  it('"Abo verwalten" opens the portal with the jwt and navigates to its url', async () => {
    store.entitlement = supporterEnt
    store.subscription = sub()
    vi.mocked(openPortal).mockResolvedValue({ ok: true, url: 'https://portal.example/x' })
    const loc: any = { href: '' }
    Object.defineProperty(window, 'location', { value: loc, configurable: true })
    const w = mountCard()
    await w.findAll('button').find(b => b.text() === 'Abo verwalten')!.trigger('click')
    await flushPromises()
    expect(openPortal).toHaveBeenCalledWith('jwt-1')
    expect(loc.href).toBe('https://portal.example/x')
  })

  it('cancel scheduled: shows "endet am" and "Kündigung zurücknehmen"; resume reloads the store', async () => {
    store.entitlement = supporterEnt
    store.subscription = sub({ cancelAtPeriodEnd: true })
    store.isCancelScheduled = true
    vi.mocked(resumeSubscription).mockResolvedValue({ ok: true })
    const w = mountCard()
    expect(w.text()).toContain('endet am 24.12.2026')
    await w.findAll('button').find(b => b.text() === 'Kündigung zurücknehmen')!.trigger('click')
    await flushPromises()
    expect(resumeSubscription).toHaveBeenCalledWith('jwt-1')
    expect(store.load).toHaveBeenCalled()
  })

  it('past_due: shows a warning and a button that opens the portal', async () => {
    store.entitlement = supporterEnt
    store.subscription = sub({ status: 'past_due' })
    store.isPastDue = true
    vi.mocked(openPortal).mockResolvedValue({ ok: false, error: 'unknown' })
    const w = mountCard()
    expect(w.find('.plan-warning').text()).toContain('Zahlung fehlgeschlagen')
    await w.findAll('button').find(b => b.text() === 'Zahlungsmittel aktualisieren')!.trigger('click')
    await flushPromises()
    expect(openPortal).toHaveBeenCalledWith('jwt-1')
  })

  it('native: neutral text, no buy link, no price', () => {
    isNative.value = true
    store._eligible = true
    const w = mountCard()
    expect(w.text()).toContain('Supporter kannst du auf trailradar.org abschließen.')
    expect(w.find('a[href="/plans"]').exists()).toBe(false)
    expect(w.text()).not.toMatch(/€/)
  })

  it('always offers a "Verträge hier kündigen" link at the bottom', () => {
    const w = mountCard()
    const link = w.find('a.plan-cancel-link')
    expect(link.attributes('href')).toBe('/kuendigen')
    expect(link.text()).toBe('Verträge hier kündigen')
  })
})
