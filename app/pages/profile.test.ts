import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

// Scoped to the "Hochgeladene Fotos" photo-delete feature only — this page
// has no existing test file, and per the implementation plan this suite
// doesn't attempt to cover the rest of the profile page (avatar upload,
// password change, invitation codes, etc.).

let fakeAuthStore: {
  isLoggedIn: boolean
  nickname: string
  avatarUrl: string
  getUserId: () => Promise<string>
  deleteTrailPhoto: (photo: { id: string | number; url: string }) => Promise<void>
}
let fakeMapStore: { authModalOpen: boolean }

const PHOTO_ROW = {
  id: 'p1',
  url: 'https://example.com/photo1.jpg',
  created_at: '2026-01-01T00:00:00Z',
  trail_id: 't1',
  trails: { name: 'Flowtrail Tegernsee' },
  copyright: null as string | null,
}

const selectedColumns: Record<string, string> = {}

function fakeClient(photosData: unknown[] = [PHOTO_ROW]) {
  const from = vi.fn((table: string) => ({
    select: (cols: string) => (selectedColumns[table] = cols, {
      eq: () => Promise.resolve({
        data: table === 'trail_photos' ? photosData : [],
        error: null,
      }),
    }),
  }))
  return { from }
}

vi.stubGlobal('useSeoMeta', vi.fn())
vi.stubGlobal('useAuthStore', () => fakeAuthStore)
vi.stubGlobal('useMapStore', () => fakeMapStore)

vi.mock('~/map/confirmDialog', () => ({ confirmDialog: vi.fn() }))
vi.mock('~/utils/toast', () => ({ showToast: vi.fn() }))
vi.mock('~/communication/photos', () => ({ updatePhotoCopyright: vi.fn() }))

import ProfilePage from './profile.vue'
import { confirmDialog } from '~/map/confirmDialog'
import { showToast } from '~/utils/toast'
import { updatePhotoCopyright } from '~/communication/photos'

const StubLink = { template: '<a><slot /></a>' }
const StubPageHero = { template: '<div><slot /></div>' }
const StubPlanCard = { template: '<section class="stub-plan-card" />' }
const StubDeleteAccount = { template: '<section class="stub-delete-account" />' }

function mountProfile(photosData: unknown[] = [PHOTO_ROW]) {
  const client = fakeClient(photosData)
  vi.stubGlobal('useSupabaseClient', () => client)
  vi.stubGlobal('useSupabaseUser', () => ref({ id: 'u1', email: 'rider@example.com' }))

  return mount(ProfilePage, {
    global: {
      stubs: { NuxtLink: StubLink, PageHero: StubPageHero, PlanCard: StubPlanCard, DeleteAccountSection: StubDeleteAccount },
    },
  })
}

describe('profile.vue — photo delete', () => {
  beforeEach(() => {
    fakeAuthStore = {
      isLoggedIn: true,
      nickname: 'TestRider',
      avatarUrl: '',
      getUserId: vi.fn().mockResolvedValue('u1'),
      deleteTrailPhoto: vi.fn().mockResolvedValue(undefined),
    }
    fakeMapStore = { authModalOpen: false }
    vi.mocked(confirmDialog).mockReset().mockResolvedValue(true)
    vi.mocked(showToast).mockReset()
  })

  it('mounts the plan card right after the profile header', () => {
    const wrapper = mountProfile()
    const children = Array.from(wrapper.find('.profile-layout').element.children)
    const header = children.findIndex(el => el.classList.contains('profile-header'))
    expect(children[header + 1]?.classList.contains('stub-plan-card')).toBe(true)
  })

  it('mounts the delete-account section as the last section, after the photos', async () => {
    const wrapper = mountProfile([PHOTO_ROW])
    await flushPromises()
    const children = Array.from(wrapper.find('.profile-layout').element.children)
    expect(children.at(-1)?.classList.contains('stub-delete-account')).toBe(true)
  })

  it('renders a delete button on every uploaded photo card', async () => {
    const wrapper = mountProfile([PHOTO_ROW, { ...PHOTO_ROW, id: 'p2' }])
    await flushPromises()

    expect(wrapper.findAll('.photo-card')).toHaveLength(2)
    expect(wrapper.findAll('.photo-delete-btn')).toHaveLength(2)
  })

  it('confirming delete calls deleteTrailPhoto and removes the card from the list', async () => {
    const wrapper = mountProfile([PHOTO_ROW])
    await flushPromises()
    expect(wrapper.findAll('.photo-card')).toHaveLength(1)

    await wrapper.find('.photo-delete-btn').trigger('click')
    await flushPromises()

    expect(fakeAuthStore.deleteTrailPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', url: PHOTO_ROW.url }),
    )
    expect(wrapper.findAll('.photo-card')).toHaveLength(0)
  })

  it('cancelling the confirm dialog leaves the photo in place', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(false)
    const wrapper = mountProfile([PHOTO_ROW])
    await flushPromises()

    await wrapper.find('.photo-delete-btn').trigger('click')
    await flushPromises()

    expect(fakeAuthStore.deleteTrailPhoto).not.toHaveBeenCalled()
    expect(wrapper.findAll('.photo-card')).toHaveLength(1)
  })

  it('shows an error toast and keeps the photo when deleteTrailPhoto rejects', async () => {
    fakeAuthStore.deleteTrailPhoto = vi.fn().mockRejectedValue(new Error('forbidden'))
    const wrapper = mountProfile([PHOTO_ROW])
    await flushPromises()

    await wrapper.find('.photo-delete-btn').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('.photo-card')).toHaveLength(1)
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('fehlgeschlagen'))
  })
})

describe('profile.vue — photo copyright', () => {
  beforeEach(() => {
    fakeAuthStore = {
      isLoggedIn: true,
      nickname: 'TestRider',
      avatarUrl: '',
      getUserId: vi.fn().mockResolvedValue('u1'),
      deleteTrailPhoto: vi.fn().mockResolvedValue(undefined),
    }
    fakeMapStore = { authModalOpen: false }
    vi.mocked(showToast).mockReset()
    vi.mocked(updatePhotoCopyright).mockReset().mockImplementation(async (_id, value) => (value as string).trim() || null)
  })

  it('selects the copyright column for the uploaded photos', async () => {
    mountProfile()
    await flushPromises()
    expect(selectedColumns.trail_photos).toMatch(/\bcopyright\b/)
  })

  it('prefills each photo card with its current copyright', async () => {
    const wrapper = mountProfile([{ ...PHOTO_ROW, copyright: 'Max Muster' }])
    await flushPromises()
    expect((wrapper.get('.photo-card input[name="copyright"]').element as HTMLInputElement).value).toBe('Max Muster')
  })

  it('adds a forgotten copyright afterwards and saves it for that photo', async () => {
    const wrapper = mountProfile([PHOTO_ROW])
    await flushPromises()

    await wrapper.get('.photo-card input[name="copyright"]').setValue('Max Muster')
    await wrapper.get('.photo-card form').trigger('submit')
    await flushPromises()

    expect(updatePhotoCopyright).toHaveBeenCalledWith('p1', 'Max Muster', expect.anything())
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('gespeichert'))
  })

  it('only offers the save button once the value was changed', async () => {
    const wrapper = mountProfile([{ ...PHOTO_ROW, copyright: 'Max' }])
    await flushPromises()
    expect(wrapper.find('.photo-card .copyright-save').exists()).toBe(false)

    await wrapper.get('.photo-card input[name="copyright"]').setValue('Moritz')
    expect(wrapper.find('.photo-card .copyright-save').exists()).toBe(true)
  })

  it('shows an error toast and keeps the edit when saving fails', async () => {
    vi.mocked(updatePhotoCopyright).mockRejectedValue(new Error('not permitted'))
    const wrapper = mountProfile([PHOTO_ROW])
    await flushPromises()

    await wrapper.get('.photo-card input[name="copyright"]').setValue('Max')
    await wrapper.get('.photo-card form').trigger('submit')
    await flushPromises()

    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('fehlgeschlagen'))
    expect(wrapper.find('.photo-card .copyright-save').exists()).toBe(true)
  })
})
