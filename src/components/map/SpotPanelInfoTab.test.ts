import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import type { Trail } from '~/types/Trail'

// SpotPanelInfoTab.vue relies on Nuxt's implicit auto-imports for the Pinia
// stores/composables it reads (useSpotPanelStore/useAuthStore/useMapStore/
// useSupabaseUser) — same pattern as SpotPanelComments.test.ts. Replaces the
// innerHTML-driven loadInfo()/updateLikeButton()/setupComments()/
// loadComments() in spotPanel.ts (Phase 5a of the spot-panel Vue migration).
// detail_popup/, lightbox.ts stay unchanged per the migration's hard
// constraint — mocked here purely to isolate this component's own logic
// (fetch orchestration, like-state population, eager refetch on spot
// change), not to test their internals (already covered elsewhere).
let fakeAuthStore: {
  isLoggedIn: boolean
  isAdmin: boolean
  isTrailcrew: boolean
  nickname: string
  avatarUrl: string
  getToken: () => Promise<string>
}
let fakeMapStore: { authModalOpen: boolean; reportModalOpen: boolean; reportModalTrailId: string | null; reportModalTrailName: string | null }
let fakeUser: { value: { id: string; email: string } | null }

vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)
vi.stubGlobal('useAuthStore', () => fakeAuthStore)
vi.stubGlobal('useMapStore', () => fakeMapStore)
vi.stubGlobal('useSupabaseUser', () => fakeUser)

vi.mock('~/communication/trails', () => ({ getTrailDetails: vi.fn() }))
vi.mock('~/map/detail_popup/detailsPopup', () => ({ renderTrailDetails: vi.fn() }))
vi.mock('~/map/detail_popup/logic', () => ({ bindPopupEvents: vi.fn(async () => {}), startPhotoCarousel: vi.fn() }))
vi.mock('~/map/detail_popup/yt', () => ({ setupYT2Click: vi.fn() }))
vi.mock('~/map/lightbox', () => ({ bindPhotoLightbox: vi.fn() }))
// SpotPanelComments.vue (mounted as a real child, not mocked — this test
// exercises the actual mount-into-#spot-comments-section wiring) calls the
// real spotPanel store, whose loadComments() hits communication/comments.ts.
// Mocked here purely so the test suite never touches the network, per
// CLAUDE.md's test mandate — same mocks as SpotPanelComments.test.ts.
vi.mock('~/communication/comments', () => ({
  getComments: vi.fn(async () => []),
  getOlderComments: vi.fn(async () => []),
  postComment: vi.fn(),
  deleteComment: vi.fn(),
  COMMENTS_PAGE_SIZE: 20,
}))

import { getTrailDetails } from '~/communication/trails'
import { renderTrailDetails } from '~/map/detail_popup/detailsPopup'
import SpotPanelInfoTab from './SpotPanelInfoTab.vue'

function trail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: 't1', name: 'Flowtrail Tegernsee', type: 'trail',
    latitude: 1, longitude: 1, approved: true, url: '',
    creator: '', instagram: '', spotcheck: '', created_at: '',
    ...overrides,
  } as Trail
}

function details(overrides: Record<string, any> = {}) {
  return {
    id: 't1', rules: [], description: '', last_update: '2026-08-01',
    opening_hours: '', trail_description: '', photos: [], videos: [], likes: [],
    ...overrides,
  }
}

describe('SpotPanelInfoTab', () => {
  let store: ReturnType<typeof useSpotPanelStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSpotPanelStore()
    fakeAuthStore = {
      isLoggedIn: false, isAdmin: false, isTrailcrew: false,
      nickname: '', avatarUrl: '', getToken: vi.fn(async () => ''),
    }
    fakeMapStore = { authModalOpen: false, reportModalOpen: false, reportModalTrailId: null, reportModalTrailName: null }
    fakeUser = { value: null }
    vi.mocked(getTrailDetails).mockReset()
    vi.mocked(renderTrailDetails).mockReset()
    vi.mocked(renderTrailDetails).mockReturnValue('<div id="spot-comments-section"></div>')
  })

  it('shows a loading spinner while the fetch is in flight', async () => {
    store.currentItem = trail()
    let resolveFn: (v: any) => void = () => {}
    vi.mocked(getTrailDetails).mockReturnValue(new Promise(r => { resolveFn = r }))

    const wrapper = mount(SpotPanelInfoTab)
    expect(wrapper.find('.spot-info-loading').exists()).toBe(true)

    resolveFn(details())
    await flushPromises()
    expect(wrapper.find('.spot-info-loading').exists()).toBe(false)
  })

  it('renders the fetched details and reveals the like button (not liked)', async () => {
    store.currentItem = trail()
    vi.mocked(getTrailDetails).mockResolvedValue(details())

    const wrapper = mount(SpotPanelInfoTab)
    await flushPromises()

    expect(wrapper.find('.spot-info-content').exists()).toBe(true)
    expect(store.likeVisible).toBe(true)
    expect(store.isLiked).toBe(false)
  })

  it('marks isLiked true when the current user is among the trail\'s likes', async () => {
    fakeUser.value = { id: 'u1', email: '' }
    store.currentItem = trail()
    vi.mocked(getTrailDetails).mockResolvedValue(details({ likes: [{ user_id: 'u1' }] }))

    mount(SpotPanelInfoTab)
    await flushPromises()

    expect(store.isLiked).toBe(true)
  })

  it('shows an error message and hides the loading spinner when the fetch fails', async () => {
    store.currentItem = trail()
    vi.mocked(getTrailDetails).mockRejectedValue(new Error('network down'))

    const wrapper = mount(SpotPanelInfoTab)
    await flushPromises()

    expect(wrapper.find('.spot-info-loading').exists()).toBe(false)
    expect(wrapper.find('.spot-info-error').exists()).toBe(true)
  })

  it('mounts the comments island into the #spot-comments-section placeholder and triggers a load', async () => {
    store.currentItem = trail()
    vi.mocked(getTrailDetails).mockResolvedValue(details())
    const loadCommentsSpy = vi.spyOn(store, 'loadComments')

    const wrapper = mount(SpotPanelInfoTab)
    await flushPromises()
    await flushPromises()

    // SpotPanelComments.vue's own header renders unconditionally
    expect(wrapper.find('.comments-header').exists()).toBe(true)
    expect(loadCommentsSpy).toHaveBeenCalledWith('t1', expect.objectContaining({ userId: '' }))
  })

  it('does not reload comments when they are already loaded for this spot', async () => {
    store.currentItem = trail()
    store.commentsLoaded = true
    vi.mocked(getTrailDetails).mockResolvedValue(details())
    const loadCommentsSpy = vi.spyOn(store, 'loadComments')

    mount(SpotPanelInfoTab)
    await flushPromises()
    await flushPromises()

    expect(loadCommentsSpy).not.toHaveBeenCalled()
  })

  it('refetches when the panel moves to a different spot', async () => {
    store.currentItem = trail({ id: 't1' })
    vi.mocked(getTrailDetails).mockResolvedValue(details({ id: 't1' }))

    mount(SpotPanelInfoTab)
    await flushPromises()
    expect(getTrailDetails).toHaveBeenCalledTimes(1)

    vi.mocked(getTrailDetails).mockResolvedValue(details({ id: 't2' }))
    store.currentItem = trail({ id: 't2', name: 'Other Trail' })
    await flushPromises()

    expect(getTrailDetails).toHaveBeenCalledTimes(2)
  })

  it('resets to the loading state when the panel closes (currentItem becomes null)', async () => {
    store.currentItem = trail()
    vi.mocked(getTrailDetails).mockResolvedValue(details())

    const wrapper = mount(SpotPanelInfoTab)
    await flushPromises()
    expect(wrapper.find('.spot-info-content').exists()).toBe(true)

    store.currentItem = null
    await flushPromises()

    expect(wrapper.find('.spot-info-content').exists()).toBe(false)
    expect(wrapper.find('.spot-info-loading').exists()).toBe(true)
  })
})
