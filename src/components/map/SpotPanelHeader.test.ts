import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import type { Trail } from '~/types/Trail'
import SpotPanelHeader from './SpotPanelHeader.vue'

// SpotPanelHeader.vue relies on Nuxt's implicit auto-import of
// useSpotPanelStore — see vitest.setup.ts and SpotPanelToursTab.test.ts for
// the same pattern. Replaces the header block of spotPanel.ts's buildDOM()/
// openInternal()/updateLikeButton() (Phase 4 of the spot-panel Vue
// migration). Reads title/org-link/share-visibility straight off
// store.currentItem (already reactively kept in sync by spotPanel.ts —
// same as SpotPanelParkingTab's currentItem, no duplicate state); the like
// button's own state (isLiked/likeVisible) is new store state this phase
// adds, since it isn't derived from anything else already on the store.
vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)

function trail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: 't1', name: 'Flowtrail Tegernsee', type: 'trail',
    latitude: 1, longitude: 1, approved: true, url: '',
    creator: '', instagram: '', spotcheck: '', created_at: '',
    ...overrides,
  } as Trail
}

function noop() {}

describe('SpotPanelHeader', () => {
  let store: ReturnType<typeof useSpotPanelStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSpotPanelStore()
  })

  it('renders the current item name as the title', () => {
    store.currentItem = trail({ name: 'Waldkopf Trail' })
    const wrapper = mount(SpotPanelHeader, { props: { onLike: noop, onShare: noop, onClose: noop } })
    expect(wrapper.get('.spot-panel-title').text()).toBe('Waldkopf Trail')
  })

  it('shows the org link with its href when the item has a url', () => {
    store.currentItem = trail({ url: 'https://trailcrew.example.com' })
    const wrapper = mount(SpotPanelHeader, { props: { onLike: noop, onShare: noop, onClose: noop } })
    const link = wrapper.get('.spot-panel-org-link')
    expect(link.classes()).not.toContain('hidden')
    expect(link.attributes('href')).toBe('https://trailcrew.example.com')
  })

  it('hides the org link when the item has no url', () => {
    store.currentItem = trail({ url: '' })
    const wrapper = mount(SpotPanelHeader, { props: { onLike: noop, onShare: noop, onClose: noop } })
    expect(wrapper.get('.spot-panel-org-link').classes()).toContain('hidden')
  })

  it('shows the share button for an approved spot and hides it for an unapproved one', () => {
    store.currentItem = trail({ approved: true })
    let wrapper = mount(SpotPanelHeader, { props: { onLike: noop, onShare: noop, onClose: noop } })
    expect(wrapper.get('.spot-share-btn').classes()).not.toContain('hidden')

    store.currentItem = trail({ approved: false })
    wrapper = mount(SpotPanelHeader, { props: { onLike: noop, onShare: noop, onClose: noop } })
    expect(wrapper.get('.spot-share-btn').classes()).toContain('hidden')
  })

  it('hides the like button until likeVisible is set (preserves the Info-tab-load coupling)', () => {
    store.currentItem = trail()
    store.likeVisible = false
    const wrapper = mount(SpotPanelHeader, { props: { onLike: noop, onShare: noop, onClose: noop } })
    expect(wrapper.get('.spot-like-btn').classes()).toContain('hidden')
  })

  it('shows the like button once likeVisible is true, with an outline star when not liked', () => {
    store.currentItem = trail()
    store.likeVisible = true
    store.isLiked = false
    const wrapper = mount(SpotPanelHeader, { props: { onLike: noop, onShare: noop, onClose: noop } })
    const likeBtn = wrapper.get('.spot-like-btn')
    expect(likeBtn.classes()).not.toContain('hidden')
    expect(likeBtn.find('.fa-regular.fa-star').exists()).toBe(true)
  })

  it('shows a filled star when liked', () => {
    store.currentItem = trail()
    store.likeVisible = true
    store.isLiked = true
    const wrapper = mount(SpotPanelHeader, { props: { onLike: noop, onShare: noop, onClose: noop } })
    expect(wrapper.get('.spot-like-btn').text()).toContain('⭐')
  })

  it('calls onLike when the like button is clicked', async () => {
    store.currentItem = trail()
    store.likeVisible = true
    const onLike = vi.fn()
    const wrapper = mount(SpotPanelHeader, { props: { onLike, onShare: noop, onClose: noop } })
    await wrapper.get('.spot-like-btn').trigger('click')
    expect(onLike).toHaveBeenCalledOnce()
  })

  it('calls onShare when the share button is clicked', async () => {
    store.currentItem = trail()
    const onShare = vi.fn()
    const wrapper = mount(SpotPanelHeader, { props: { onLike: noop, onShare, onClose: noop } })
    await wrapper.get('.spot-share-btn').trigger('click')
    expect(onShare).toHaveBeenCalledOnce()
  })

  it('calls onClose when the close button is clicked', async () => {
    store.currentItem = trail()
    const onClose = vi.fn()
    const wrapper = mount(SpotPanelHeader, { props: { onLike: noop, onShare: noop, onClose } })
    await wrapper.get('.spot-panel-close').trigger('click')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
