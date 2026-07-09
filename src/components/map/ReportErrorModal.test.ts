import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useMapStore } from '~/stores/map'

// ReportErrorModal.vue relies on Nuxt's implicit auto-imports for the two
// Pinia stores it reads (`useAuthStore`, `useMapStore`) — `ref`/`watch`/
// `onMounted`/`onUnmounted`/`defineStore` are stubbed globally for all tests
// in vitest.setup.ts. `useMapStore` is stubbed here with the *real*
// implementation (it's plain Pinia, no Supabase dependency) so the store
// behaviour under test is real; `useAuthStore` is stubbed with a minimal
// fake since the real store pulls in `useSupabaseClient`/`useSupabaseUser`,
// which only exist inside a live Nuxt app.
let fakeAuthStore: { isLoggedIn: boolean; userId: string | undefined }

vi.stubGlobal('useMapStore', useMapStore)
vi.stubGlobal('useAuthStore', () => fakeAuthStore)

vi.mock('~/communication/report', () => ({ submitReport: vi.fn() }))
vi.mock('~/utils/toast', () => ({ showToast: vi.fn() }))

import { submitReport } from '~/communication/report'
import { showToast } from '~/utils/toast'
import ReportErrorModal from './ReportErrorModal.vue'

function byTestId<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.querySelector(`[data-testid="${id}"]`)
}

async function setTextarea(value: string) {
  const el = byTestId<HTMLTextAreaElement>('report-error-textarea')!
  el.value = value
  el.dispatchEvent(new Event('input'))
  await nextTick()
}

async function click(id: string) {
  byTestId(id)!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
}

describe('ReportErrorModal', () => {
  let wrapper: VueWrapper<any>
  let mapStore: ReturnType<typeof useMapStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    mapStore = useMapStore()
    fakeAuthStore = { isLoggedIn: false, userId: undefined }
    vi.mocked(submitReport).mockReset()
    vi.mocked(showToast).mockReset()
  })

  afterEach(() => {
    wrapper?.unmount()
    document.body.innerHTML = ''
  })

  function openModal(trailId = 'trail-1', trailName = 'Flowtrail Süd') {
    mapStore.reportModalOpen = true
    mapStore.reportModalTrailId = trailId
    mapStore.reportModalTrailName = trailName
  }

  it('is not rendered when the modal is closed', () => {
    wrapper = mount(ReportErrorModal)
    expect(byTestId('report-error-backdrop')).toBeNull()
  })

  it('renders trail name, textarea and counter when open', async () => {
    openModal()
    wrapper = mount(ReportErrorModal)
    await nextTick()

    expect(byTestId('report-error-backdrop')).not.toBeNull()
    expect(byTestId('report-error-modal')?.textContent).toContain('Flowtrail Süd')
    expect(byTestId('report-error-textarea')).not.toBeNull()
    expect(byTestId('report-error-counter')?.textContent).toContain('0 / 1000')
  })

  it('has a maxlength of 1000 on the textarea and updates the live counter as text is typed', async () => {
    openModal()
    wrapper = mount(ReportErrorModal)
    await nextTick()

    expect(byTestId('report-error-textarea')?.getAttribute('maxlength')).toBe('1000')

    const text = 'Der Trail ist gesperrt'
    await setTextarea(text)
    expect(byTestId('report-error-counter')?.textContent).toContain(`${text.length} / 1000`)
  })

  it('disables the submit button when the message is empty or whitespace-only', async () => {
    openModal()
    wrapper = mount(ReportErrorModal)
    await nextTick()

    expect(byTestId<HTMLButtonElement>('report-error-submit')?.disabled).toBe(true)

    await setTextarea('   ')
    expect(byTestId<HTMLButtonElement>('report-error-submit')?.disabled).toBe(true)

    await setTextarea('Trail gesperrt seit Mai')
    expect(byTestId<HTMLButtonElement>('report-error-submit')?.disabled).toBe(false)
  })

  it('on success: calls submitReport with the right args, shows a toast, closes the modal and resets the message', async () => {
    vi.mocked(submitReport).mockResolvedValue(undefined)
    openModal('trail-1', 'Flowtrail Süd')
    wrapper = mount(ReportErrorModal)
    await nextTick()

    await setTextarea('Trail ist seit Wochen gesperrt')
    await click('report-error-submit')
    await flushPromises()

    expect(submitReport).toHaveBeenCalledWith('trail-1', 'Flowtrail Süd', 'Trail ist seit Wochen gesperrt', undefined)
    expect(showToast).toHaveBeenCalledWith('Danke, wir schauen uns das an! 🙏', 'success')
    expect(mapStore.reportModalOpen).toBe(false)

    // Reopen (component stays mounted) and confirm the message was reset
    openModal()
    await nextTick()
    expect(byTestId<HTMLTextAreaElement>('report-error-textarea')?.value).toBe('')
  })

  it('includes the user id in the payload when the reporter is logged in', async () => {
    vi.mocked(submitReport).mockResolvedValue(undefined)
    fakeAuthStore = { isLoggedIn: true, userId: 'user-42' }
    openModal('trail-1', 'Flowtrail Süd')
    wrapper = mount(ReportErrorModal)
    await nextTick()

    await setTextarea('Trail gesperrt')
    await click('report-error-submit')
    await flushPromises()

    expect(submitReport).toHaveBeenCalledWith('trail-1', 'Flowtrail Süd', 'Trail gesperrt', 'user-42')
  })

  it('on failure: shows an inline error, keeps the modal open, and preserves the message', async () => {
    vi.mocked(submitReport).mockRejectedValue(new Error('500 server exploded'))
    openModal('trail-1', 'Flowtrail Süd')
    wrapper = mount(ReportErrorModal)
    await nextTick()

    await setTextarea('Trail gesperrt')
    await click('report-error-submit')
    await flushPromises()

    expect(byTestId('report-error-error')?.textContent).toBe('Senden fehlgeschlagen, bitte versuche es erneut.')
    expect(mapStore.reportModalOpen).toBe(true)
    expect(byTestId<HTMLTextAreaElement>('report-error-textarea')?.value).toBe('Trail gesperrt')
    expect(showToast).not.toHaveBeenCalled()
  })

  it('Abbrechen closes the modal without submitting', async () => {
    openModal()
    wrapper = mount(ReportErrorModal)
    await nextTick()

    await setTextarea('etwas stimmt nicht')
    await click('report-error-cancel')

    expect(mapStore.reportModalOpen).toBe(false)
    expect(submitReport).not.toHaveBeenCalled()
  })

  it('Escape closes the modal without submitting', async () => {
    openModal()
    wrapper = mount(ReportErrorModal)
    await nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(mapStore.reportModalOpen).toBe(false)
    expect(submitReport).not.toHaveBeenCalled()
  })

  it('a backdrop click closes the modal without submitting', async () => {
    openModal()
    wrapper = mount(ReportErrorModal)
    await nextTick()

    await click('report-error-backdrop')

    expect(mapStore.reportModalOpen).toBe(false)
    expect(submitReport).not.toHaveBeenCalled()
  })
})
