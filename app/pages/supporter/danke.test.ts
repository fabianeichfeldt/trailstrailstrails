import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

let auth: { isLoggedIn: boolean }
let sub: { entitlement: { level: number }; load: ReturnType<typeof vi.fn> }
let map: { authModalOpen: boolean }
const useHead = vi.fn()

vi.stubGlobal('useAuthStore', () => auth)
vi.stubGlobal('useSubscriptionStore', () => sub)
vi.stubGlobal('useMapStore', () => map)
vi.stubGlobal('useHead', useHead)
vi.stubGlobal('useSeoMeta', vi.fn())
vi.stubGlobal('useRoute', () => ({ query: { checkout_id: 'ch_1', status: 'completed' } }))

import DankePage from './danke.vue'

const stubs = { NuxtLink: { template: '<a><slot /></a>' }, PageHero: { template: '<div><slot /></div>' } }
const mountPage = () => mount(DankePage, { global: { stubs } })

describe('supporter/danke.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    auth = reactive({ isLoggedIn: true })
    map = reactive({ authModalOpen: false })
    sub = reactive({ entitlement: { level: 0 }, load: vi.fn().mockResolvedValue(undefined) })
    useHead.mockClear()
  })
  afterEach(() => { vi.useRealTimers() })

  it('has a back link to the map', () => {
    const w = mountPage()
    expect(w.text()).toContain('← Zurück zur Karte')
  })

  it('sets robots noindex', () => {
    mountPage()
    expect(JSON.stringify(useHead.mock.calls)).toContain('noindex')
  })

  it('logged out: shows a login prompt, opens the auth modal and does not poll', async () => {
    auth.isLoggedIn = false
    const w = mountPage()
    await vi.advanceTimersByTimeAsync(6000)
    expect(sub.load).not.toHaveBeenCalled()
    await w.get('button.btn-primary').trigger('click')
    expect(map.authModalOpen).toBe(true)
  })

  it('logged out: starts polling once the user logs in', async () => {
    auth.isLoggedIn = false
    mountPage()
    auth.isLoggedIn = true
    await vi.advanceTimersByTimeAsync(2100)
    expect(sub.load).toHaveBeenCalled()
  })

  it('polls every 2 s and shows success once level >= 1, then stops', async () => {
    const w = mountPage()
    await vi.advanceTimersByTimeAsync(2000)
    sub.entitlement.level = 1
    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()
    expect(w.text()).toContain('Danke! Trail-Zustand ist freigeschaltet.')
    expect(w.text()).toContain('Zur Karte')
    const calls = sub.load.mock.calls.length
    await vi.advanceTimersByTimeAsync(10000)
    expect(sub.load.mock.calls.length).toBe(calls)
  })

  it('gives up after 15 tries with calm timeout copy (no error styling)', async () => {
    const w = mountPage()
    await vi.advanceTimersByTimeAsync(60000)
    await flushPromises()
    expect(sub.load).toHaveBeenCalledTimes(15)
    expect(w.text()).toContain('Zahlung eingegangen — die Freischaltung dauert noch einen Moment.')
    expect(w.find('.error, .auth-error').exists()).toBe(false)
  })

  it('ignores URL query params: level 0 keeps polling', async () => {
    const w = mountPage()
    await vi.advanceTimersByTimeAsync(4000)
    expect(w.text()).not.toContain('freigeschaltet')
    expect(sub.load.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('clears the interval on unmount', async () => {
    const w = mountPage()
    await vi.advanceTimersByTimeAsync(2000)
    w.unmount()
    const calls = sub.load.mock.calls.length
    await vi.advanceTimersByTimeAsync(10000)
    expect(sub.load.mock.calls.length).toBe(calls)
  })
})
