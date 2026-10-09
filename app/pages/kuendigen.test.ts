import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

let auth: { isLoggedIn: boolean; getToken: ReturnType<typeof vi.fn> }
let sub: { subscription: Record<string, unknown> | null; isCancelScheduled: boolean; load: ReturnType<typeof vi.fn> }
const useHead = vi.fn()

vi.stubGlobal('useAuthStore', () => auth)
vi.stubGlobal('useSubscriptionStore', () => sub)
vi.stubGlobal('useHead', useHead)
vi.stubGlobal('useSeoMeta', vi.fn())

vi.mock('~/communication/billing', () => ({
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
}))

import KuendigenPage from './kuendigen.vue'
import { cancelSubscription, resumeSubscription } from '~/communication/billing'

const stubs = { NuxtLink: { template: '<a><slot /></a>' }, PageHero: { template: '<div><slot /></div>' } }
const mountPage = () => mount(KuendigenPage, { global: { stubs } })

const LIVE = { id: 's1', status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: '2026-11-03T10:00:00Z' }

describe('kuendigen.vue', () => {
  beforeEach(() => {
    auth = reactive({ isLoggedIn: false, getToken: vi.fn().mockResolvedValue('jwt-1') })
    sub = reactive({ subscription: null, isCancelScheduled: false, load: vi.fn().mockResolvedValue(undefined) })
    vi.mocked(cancelSubscription).mockReset()
    vi.mocked(resumeSubscription).mockReset()
    useHead.mockClear()
  })

  it('title is exactly "Verträge hier kündigen" (h1 and useHead)', () => {
    const w = mountPage()
    expect(w.get('h1').text()).toBe('Verträge hier kündigen')
    expect(JSON.stringify(useHead.mock.calls)).toContain('"title":"Verträge hier kündigen"')
  })

  it('has a back link to the map', () => {
    expect(mountPage().text()).toContain('← Zurück zur Karte')
  })

  it('logged in + live subscription: shows contract, end date and one-click cancel with the JWT', async () => {
    auth.isLoggedIn = true
    sub.subscription = { ...LIVE }
    vi.mocked(cancelSubscription).mockResolvedValue({ ok: true, receivedAt: '2026-10-03T10:15:00Z' })
    const w = mountPage()
    expect(w.text()).toContain('TrailRadar Supporter')
    expect(w.text()).toContain('3. November 2026')
    await w.get('button.btn-danger').trigger('click')
    await flushPromises()
    expect(cancelSubscription).toHaveBeenCalledWith({ jwt: 'jwt-1' })
    expect(w.text()).toContain('3. Oktober 2026')
    expect(w.text()).toContain('12:15')
    expect(w.text()).toContain('bei uns eingegangen')
  })

  it('past_due counts as a live subscription', () => {
    auth.isLoggedIn = true
    sub.subscription = { ...LIVE, status: 'past_due' }
    const w = mountPage()
    expect(w.text()).toContain('TrailRadar Supporter')
    expect(w.find('input[type=email]').exists()).toBe(false)
  })

  it('logged in + scheduled: shows end date and resume, which resumes then reloads', async () => {
    auth.isLoggedIn = true
    sub.subscription = { ...LIVE, cancelAtPeriodEnd: true }
    sub.isCancelScheduled = true
    vi.mocked(resumeSubscription).mockResolvedValue({ ok: true })
    const w = mountPage()
    expect(w.text()).toContain('Dein Abo endet am 3. November 2026')
    expect(w.text()).not.toContain('Jetzt kündigen')
    await w.get('button.btn-primary').trigger('click')
    await flushPromises()
    expect(resumeSubscription).toHaveBeenCalledWith('jwt-1')
    expect(sub.load).toHaveBeenCalled()
  })

  it('logged out: shows name + email form', () => {
    const w = mountPage()
    expect(w.find('input[name=name]').exists()).toBe(true)
    expect(w.find('input[type=email]').exists()).toBe(true)
  })

  it('logged in without subscription: also shows the form', () => {
    auth.isLoggedIn = true
    expect(mountPage().find('input[type=email]').exists()).toBe(true)
  })

  it('requires name and a valid email before calling the backend', async () => {
    const w = mountPage()
    await w.get('form').trigger('submit')
    expect(cancelSubscription).not.toHaveBeenCalled()
    await w.get('input[name=name]').setValue('Max')
    await w.get('input[type=email]').setValue('not-an-email')
    await w.get('form').trigger('submit')
    expect(cancelSubscription).not.toHaveBeenCalled()
    expect(w.text()).toContain('gültige E-Mail')
  })

  it('submits the form with email+name and shows the receipt incl. the email hint', async () => {
    vi.mocked(cancelSubscription).mockResolvedValue({ ok: true, receivedAt: '2026-10-03T10:15:00Z' })
    const w = mountPage()
    await w.get('input[name=name]').setValue('Max Muster')
    await w.get('input[type=email]').setValue('max@example.com')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(cancelSubscription).toHaveBeenCalledWith({ email: 'max@example.com', name: 'Max Muster' })
    expect(w.text()).toContain('Deine Kündigung ist am 3. Oktober 2026')
    expect(w.text()).toContain('Eine Bestätigung ist per E-Mail unterwegs (falls zu dieser Adresse ein Abo besteht).')
  })

  it('rate_limited shows a friendly retry message', async () => {
    vi.mocked(cancelSubscription).mockResolvedValue({ ok: false, error: 'rate_limited' })
    const w = mountPage()
    await w.get('input[name=name]').setValue('Max')
    await w.get('input[type=email]').setValue('max@example.com')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Zu viele Anfragen – bitte versuch es in einer Stunde erneut.')
  })

  it('unknown error shows a generic retry message and keeps the form', async () => {
    vi.mocked(cancelSubscription).mockResolvedValue({ ok: false, error: 'unknown' })
    const w = mountPage()
    await w.get('input[name=name]').setValue('Max')
    await w.get('input[type=email]').setValue('max@example.com')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Das hat leider nicht geklappt')
    expect(w.find('form').exists()).toBe(true)
  })
})
