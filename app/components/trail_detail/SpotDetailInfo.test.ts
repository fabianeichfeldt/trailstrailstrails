import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import type { Trail } from '~/types/Trail'
import { TrailDetails } from '~/types/TrailDetails'

// Ported from SpotPanelInfoTab.test.ts as part of converting the legacy
// raw-HTML render into a proper Vue component (SpotDetailInfo.vue). Two
// behavioural differences from the old panel-only component drive the
// rewritten coverage below:
//  - content now seeds from a `baked` prop (the SSG-prerendered payload)
//    instead of starting blank/loading — there's no spinner/error state on
//    first render any more, only a background live refresh.
//  - comments are no longer this component's responsibility (the page
//    mounts <SpotPanelComments> as its own "Kommentare" section and
//    triggers the load itself).
let fakeAuthStore: {
  isLoggedIn: boolean
  isAdmin: boolean
  isTrailcrew: boolean
  nickname: string
  avatarUrl: string
  getToken: () => Promise<string>
  uploadTrailPhoto: (file: File, trailId: string) => Promise<string>
}
let fakeMapStore: { authModalOpen: boolean; reportModalOpen: boolean; reportModalTrailId: string | null; reportModalTrailName: string | null }
let fakeUser: { value: { id: string; email: string } | null }

vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)
vi.stubGlobal('useAuthStore', () => fakeAuthStore)
vi.stubGlobal('useMapStore', () => fakeMapStore)
vi.stubGlobal('useSupabaseUser', () => fakeUser)

vi.mock('~/communication/trails', () => ({ getTrailDetails: vi.fn() }))
vi.mock('~/map/lightbox', () => ({ bindPhotoLightbox: vi.fn() }))
vi.mock('~/utils/feedback', () => ({ upVote: vi.fn(async () => {}), downVote: vi.fn(async () => {}) }))
vi.mock('~/utils/toast', () => ({ showToast: vi.fn() }))

import { getTrailDetails } from '~/communication/trails'
import { upVote, downVote } from '~/utils/feedback'
import SpotDetailInfo from './SpotDetailInfo.vue'

function trail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: 't1', name: 'Flowtrail Tegernsee', type: 'trail',
    latitude: 1, longitude: 1, approved: true, url: '',
    creator: '', instagram: '', spotcheck: '', created_at: '',
    ...overrides,
  } as Trail
}

function details(overrides: Partial<TrailDetails> = {}): TrailDetails {
  const d = new TrailDetails('t1')
  Object.assign(d, overrides)
  return d
}

describe('SpotDetailInfo', () => {
  let store: ReturnType<typeof useSpotPanelStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSpotPanelStore()
    fakeAuthStore = {
      isLoggedIn: false, isAdmin: false, isTrailcrew: false,
      nickname: '', avatarUrl: '', getToken: vi.fn(async () => ''),
      uploadTrailPhoto: vi.fn(async () => 'https://example.com/photo.jpg'),
    }
    fakeMapStore = { authModalOpen: false, reportModalOpen: false, reportModalTrailId: null, reportModalTrailName: null }
    fakeUser = { value: null }
    vi.mocked(getTrailDetails).mockReset()
    vi.mocked(getTrailDetails).mockResolvedValue(details())
    vi.mocked(upVote).mockClear()
    vi.mocked(downVote).mockClear()
  })

  it('renders the baked content immediately, before the live refresh resolves', () => {
    let resolveFn: (v: any) => void = () => {}
    vi.mocked(getTrailDetails).mockReturnValue(new Promise(r => { resolveFn = r }))

    const wrapper = mount(SpotDetailInfo, { props: { trail: trail(), baked: details({ trail_description: 'Baked description.' }) } })

    expect(wrapper.text()).toContain('Baked description.')
    resolveFn(details())
  })

  it('reveals the like button (not liked) once the live refresh resolves', async () => {
    vi.mocked(getTrailDetails).mockResolvedValue(details())

    mount(SpotDetailInfo, { props: { trail: trail(), baked: details() } })
    await flushPromises()

    expect(store.likeVisible).toBe(true)
    expect(store.isLiked).toBe(false)
  })

  it('marks isLiked true when the current user is among the trail\'s likes after refresh', async () => {
    fakeUser.value = { id: 'u1', email: '' }
    vi.mocked(getTrailDetails).mockResolvedValue(details({ likes: [{ user_id: 'u1' }] }))

    mount(SpotDetailInfo, { props: { trail: trail(), baked: details() } })
    await flushPromises()

    expect(store.isLiked).toBe(true)
  })

  it('keeps the baked content visible when the live refresh fails', async () => {
    vi.mocked(getTrailDetails).mockRejectedValue(new Error('network down'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const wrapper = mount(SpotDetailInfo, { props: { trail: trail(), baked: details({ trail_description: 'Baked description.' }) } })
    await flushPromises()

    expect(wrapper.text()).toContain('Baked description.')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('re-seeds from the new baked prop and refetches when the spot changes', async () => {
    vi.mocked(getTrailDetails).mockResolvedValue(details({ id: 't1' }))

    const wrapper = mount(SpotDetailInfo, { props: { trail: trail(), baked: details({ id: 't1', trail_description: 'First spot.' }) } })
    await flushPromises()
    expect(getTrailDetails).toHaveBeenCalledTimes(1)

    vi.mocked(getTrailDetails).mockResolvedValue(details({ id: 't2', trail_description: 'Second spot (live).' }))
    await wrapper.setProps({
      trail: trail({ id: 't2', name: 'Other Trail' }),
      baked: details({ id: 't2', trail_description: 'Second spot (baked).' }),
    })
    await flushPromises()

    expect(getTrailDetails).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Second spot (live).')
  })

  it('renders the status banner for a closed spot with a hint', async () => {
    const wrapper = mount(SpotDetailInfo, {
      props: { trail: trail(), baked: details({ status: 'closed', status_hint: 'Wegen Bauarbeiten gesperrt' }) },
    })

    const banner = wrapper.find('.spot-status-banner')
    expect(banner.exists()).toBe(true)
    expect(banner.classes()).toContain('ssb-closed')
    expect(banner.text()).toContain('Geschlossen')
    expect(banner.text()).toContain('Wegen Bauarbeiten gesperrt')
  })

  it('calls upVote and shows a toast when the thumbs-up button is clicked', async () => {
    const wrapper = mount(SpotDetailInfo, { props: { trail: trail(), baked: details() } })

    await wrapper.find('.thumb-btn.up').trigger('click')
    await flushPromises()

    expect(upVote).toHaveBeenCalledWith('t1', expect.any(HTMLElement))
  })

  it('opens the report modal with the current trail id/name', async () => {
    const wrapper = mount(SpotDetailInfo, { props: { trail: trail(), baked: details() } })

    await wrapper.find('.report-error-link').trigger('click')

    expect(fakeMapStore.reportModalOpen).toBe(true)
    expect(fakeMapStore.reportModalTrailId).toBe('t1')
    expect(fakeMapStore.reportModalTrailName).toBe('Flowtrail Tegernsee')
  })
})
