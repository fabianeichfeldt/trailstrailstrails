import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import type { Trail } from '~/types/Trail'

// SpotPanelHeader.vue relies on Nuxt's implicit auto-imports for the Pinia
// stores it reads (useSpotPanelStore/useAuthStore/useMapStore) — see
// vitest.setup.ts and SpotPanelComments.test.ts for the same pattern.
let fakeAuthStore: {
  isLoggedIn: boolean
  userId: string
  isAdmin: boolean
  isTrailcrew: boolean
  nickname: string
  avatarUrl: string
  getToken: () => Promise<string>
}
let fakeMapStore: { authModalOpen: boolean }

vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)
vi.stubGlobal('useAuthStore', () => fakeAuthStore)
vi.stubGlobal('useMapStore', () => fakeMapStore)

vi.mock('~/communication/trails', () => ({ likeTrail: vi.fn(), dislikeTrail: vi.fn() }))
vi.mock('~/communication/share', () => ({ share: vi.fn() }))
vi.mock('~/utils/clipboard', () => ({ copyToClipboard: vi.fn() }))

import { likeTrail, dislikeTrail } from '~/communication/trails'
import { share } from '~/communication/share'
import { copyToClipboard } from '~/utils/clipboard'
import SpotPanelHeader from './SpotPanelHeader.vue'

function trail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: 't1', name: 'Flowtrail Tegernsee', type: 'trail',
    latitude: 1, longitude: 1, approved: true, url: '',
    creator: '', instagram: '', spotcheck: '', created_at: '',
    ...overrides,
  } as Trail
}

describe('SpotPanelHeader', () => {
  let store: ReturnType<typeof useSpotPanelStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSpotPanelStore()
    fakeAuthStore = {
      isLoggedIn: false, userId: '', isAdmin: false, isTrailcrew: false,
      nickname: '', avatarUrl: '', getToken: vi.fn(async () => ''),
    }
    fakeMapStore = { authModalOpen: false }
    vi.mocked(likeTrail).mockReset()
    vi.mocked(dislikeTrail).mockReset()
    vi.mocked(share).mockReset()
    vi.mocked(copyToClipboard).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the current item name as the title', () => {
    store.currentItem = trail({ name: 'Waldkopf Trail' })
    const wrapper = mount(SpotPanelHeader)
    expect(wrapper.get('.spot-panel-title').text()).toBe('Waldkopf Trail')
  })

  it('shows the org link with its href when the item has a url', () => {
    store.currentItem = trail({ url: 'https://trailcrew.example.com' })
    const wrapper = mount(SpotPanelHeader)
    const link = wrapper.get('.spot-panel-org-link')
    expect(link.classes()).not.toContain('hidden')
    expect(link.attributes('href')).toBe('https://trailcrew.example.com')
  })

  it('hides the org link when the item has no url', () => {
    store.currentItem = trail({ url: '' })
    const wrapper = mount(SpotPanelHeader)
    expect(wrapper.get('.spot-panel-org-link').classes()).toContain('hidden')
  })

  it('shows the share button for an approved spot and hides it for an unapproved one', () => {
    store.currentItem = trail({ approved: true })
    let wrapper = mount(SpotPanelHeader)
    expect(wrapper.get('.spot-share-btn').classes()).not.toContain('hidden')

    store.currentItem = trail({ approved: false })
    wrapper = mount(SpotPanelHeader)
    expect(wrapper.get('.spot-share-btn').classes()).toContain('hidden')
  })

  it('hides the like button until likeVisible is set (preserves the Info-tab-load coupling)', () => {
    store.currentItem = trail()
    store.likeVisible = false
    const wrapper = mount(SpotPanelHeader)
    expect(wrapper.get('.spot-like-btn').classes()).toContain('hidden')
  })

  it('shows the like button once likeVisible is true, with an outline star when not liked', () => {
    store.currentItem = trail()
    store.likeVisible = true
    store.isLiked = false
    const wrapper = mount(SpotPanelHeader)
    const likeBtn = wrapper.get('.spot-like-btn')
    expect(likeBtn.classes()).not.toContain('hidden')
    expect(likeBtn.find('.fa-regular.fa-star').exists()).toBe(true)
  })

  it('shows a filled star when liked', () => {
    store.currentItem = trail()
    store.likeVisible = true
    store.isLiked = true
    const wrapper = mount(SpotPanelHeader)
    expect(wrapper.get('.spot-like-btn').text()).toContain('⭐')
  })

  it('clicking like while signed out opens the sign-in modal instead of calling the API', async () => {
    store.currentItem = trail()
    store.likeVisible = true
    fakeAuthStore.isLoggedIn = false
    const wrapper = mount(SpotPanelHeader)

    await wrapper.get('.spot-like-btn').trigger('click')

    expect(fakeMapStore.authModalOpen).toBe(true)
    expect(likeTrail).not.toHaveBeenCalled()
  })

  it('clicking like while signed in calls likeTrail and flips isLiked', async () => {
    store.currentItem = trail()
    store.likeVisible = true
    store.isLiked = false
    fakeAuthStore.isLoggedIn = true
    vi.mocked(likeTrail).mockResolvedValue(undefined as any)
    const wrapper = mount(SpotPanelHeader)

    await wrapper.get('.spot-like-btn').trigger('click')

    expect(likeTrail).toHaveBeenCalledWith('t1', expect.anything())
    expect(store.isLiked).toBe(true)
  })

  it('clicking like again while already liked calls dislikeTrail and flips isLiked back', async () => {
    store.currentItem = trail()
    store.likeVisible = true
    store.isLiked = true
    fakeAuthStore.isLoggedIn = true
    vi.mocked(dislikeTrail).mockResolvedValue(undefined as any)
    const wrapper = mount(SpotPanelHeader)

    await wrapper.get('.spot-like-btn').trigger('click')

    expect(dislikeTrail).toHaveBeenCalledWith('t1', expect.anything())
    expect(store.isLiked).toBe(false)
  })

  it('clicking close calls store.close()', async () => {
    store.currentItem = trail()
    store.isOpen = true
    const wrapper = mount(SpotPanelHeader)

    await wrapper.get('.spot-panel-close').trigger('click')

    expect(store.isOpen).toBe(false)
    expect(store.currentItem).toBeNull()
  })

  it('falls back to clipboard copy and shows a toast when native share is unavailable', async () => {
    store.currentItem = trail()
    vi.stubGlobal('navigator', { share: undefined, clipboard: { writeText: vi.fn() } })
    vi.mocked(copyToClipboard).mockResolvedValue(true)
    vi.mocked(share).mockResolvedValue(undefined as any)
    const wrapper = mount(SpotPanelHeader)

    await wrapper.get('.spot-share-btn').trigger('click')
    await Promise.resolve()
    await Promise.resolve()

    expect(copyToClipboard).toHaveBeenCalledWith('https://trailradar.org/trails/t1')
    expect(wrapper.find('.spot-share-toast').exists()).toBe(true)
    expect(wrapper.get('.spot-share-toast').text()).toBe('Link kopiert!')
  })
})
