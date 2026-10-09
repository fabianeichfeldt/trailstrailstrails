import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

vi.mock('~/communication/account', () => ({ deleteAccount: vi.fn() }))
vi.mock('~/utils/toast', () => ({ showToast: vi.fn() }))
import { deleteAccount } from '~/communication/account'
import { showToast } from '~/utils/toast'
import DeleteAccountSection from './DeleteAccountSection.vue'

let subStore: any
let authStore: any
const navigateTo = vi.fn()
vi.stubGlobal('useSubscriptionStore', () => subStore)
vi.stubGlobal('useAuthStore', () => authStore)
vi.stubGlobal('navigateTo', navigateTo)

const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const mountSection = () => mount(DeleteAccountSection, { global: { stubs: { NuxtLink, Teleport: true } } })

const sub = (o: any = {}) => ({
  id: 's1', planId: 'supporter', provider: 'creem', status: 'active',
  currentPeriodEnd: '2026-12-24T00:00:00Z', cancelAtPeriodEnd: false, hasCustomer: true,
  customerEmail: 'a@b.de', createdAt: '2026-10-01T00:00:00Z', ...o,
})

async function openAndType(w: ReturnType<typeof mountSection>, text: string) {
  await w.get('[data-testid="delete-account-open"]').trigger('click')
  await w.get('[data-testid="delete-account-input"]').setValue(text)
}

beforeEach(() => {
  subStore = reactive({ loaded: true, subscription: null })
  authStore = reactive({
    isAdmin: false,
    getToken: vi.fn().mockResolvedValue('jwt-1'),
    signOut: vi.fn().mockResolvedValue(undefined),
  })
  navigateTo.mockReset()
  vi.mocked(deleteAccount).mockReset()
  vi.mocked(showToast).mockReset()
})

describe('DeleteAccountSection', () => {
  it('explains that photos and comments stay anonymized', () => {
    const w = mountSection()
    expect(w.text()).toContain('Konto löschen')
    expect(w.text()).toContain('Gelöschter Nutzer')
  })

  it('keeps the final delete button disabled until LÖSCHEN is typed', async () => {
    const w = mountSection()
    await openAndType(w, 'loesch')
    expect(w.get('[data-testid="delete-account-confirm"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="delete-account-input"]').setValue('LÖSCHEN')
    expect(w.get('[data-testid="delete-account-confirm"]').attributes('disabled')).toBeUndefined()
  })

  it('accepts lowercase and surrounding spaces (mobile keyboards)', async () => {
    const w = mountSection()
    await openAndType(w, ' löschen ')
    expect(w.get('[data-testid="delete-account-confirm"]').attributes('disabled')).toBeUndefined()
  })

  it('deletes, signs out and goes to the map on success', async () => {
    vi.mocked(deleteAccount).mockResolvedValue({ ok: true })
    const w = mountSection()
    await openAndType(w, 'LÖSCHEN')
    await w.get('[data-testid="delete-account-confirm"]').trigger('click')
    await flushPromises()

    expect(deleteAccount).toHaveBeenCalledWith('jwt-1')
    expect(authStore.signOut).toHaveBeenCalled()
    expect(showToast).toHaveBeenCalled()
    expect(navigateTo).toHaveBeenCalledWith('/map')
  })

  it('still leaves the page when signing out fails after the account is gone', async () => {
    vi.mocked(deleteAccount).mockResolvedValue({ ok: true })
    authStore.signOut = vi.fn().mockRejectedValue(new Error('session_not_found'))
    const w = mountSection()
    await openAndType(w, 'LÖSCHEN')
    await w.get('[data-testid="delete-account-confirm"]').trigger('click')
    await flushPromises()
    expect(navigateTo).toHaveBeenCalledWith('/map')
  })

  it('shows an error and stays signed in when the delete fails', async () => {
    vi.mocked(deleteAccount).mockResolvedValue({ ok: false, error: 'unknown' })
    const w = mountSection()
    await openAndType(w, 'LÖSCHEN')
    await w.get('[data-testid="delete-account-confirm"]').trigger('click')
    await flushPromises()

    expect(w.get('[data-testid="delete-account-error"]').text()).toContain('nicht gelöscht')
    expect(authStore.signOut).not.toHaveBeenCalled()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('explains the subscription block when the server refuses with active_subscription', async () => {
    vi.mocked(deleteAccount).mockResolvedValue({ ok: false, error: 'active_subscription' })
    const w = mountSection()
    await openAndType(w, 'LÖSCHEN')
    await w.get('[data-testid="delete-account-confirm"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="delete-account-error"]').text()).toContain('Abo')
  })

  it('blocks deletion and links to /kuendigen while a paid subscription still renews', () => {
    subStore.subscription = sub()
    const w = mountSection()
    expect(w.get('[data-testid="delete-account-open"]').attributes('disabled')).toBeDefined()
    expect(w.find('a[href="/kuendigen"]').exists()).toBe(true)
  })

  it('does not block on a subscription already cancelled at period end, or a manual grant', () => {
    subStore.subscription = sub({ cancelAtPeriodEnd: true })
    expect(mountSection().get('[data-testid="delete-account-open"]').attributes('disabled')).toBeUndefined()
    subStore.subscription = sub({ provider: 'manual' })
    expect(mountSection().get('[data-testid="delete-account-open"]').attributes('disabled')).toBeUndefined()
  })

  it('keeps the button disabled until the subscription state is known', () => {
    subStore.loaded = false
    expect(mountSection().get('[data-testid="delete-account-open"]').attributes('disabled')).toBeDefined()
  })

  it('shows admins a hint instead of the delete button', () => {
    authStore.isAdmin = true
    const w = mountSection()
    expect(w.find('[data-testid="delete-account-open"]').exists()).toBe(false)
    expect(w.text()).toContain('Admin')
  })
})
