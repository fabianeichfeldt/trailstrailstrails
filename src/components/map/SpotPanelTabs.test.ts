import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import type { Trail } from '~/types/Trail'
import SpotPanelTabs from './SpotPanelTabs.vue'

// SpotPanelTabs.vue relies on Nuxt's implicit auto-import of
// useSpotPanelStore — see vitest.setup.ts and SpotPanelToursTab.test.ts for
// the same pattern. This component only owns the tab-button bar: which one
// is highlighted, which are visible, and writing a click to
// store.activeTab — the content panes live in SpotPanel.vue.
vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)

function trail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: 't1', name: 'Flowtrail Tegernsee', type: 'trail',
    latitude: 1, longitude: 1, approved: true, url: '',
    creator: '', instagram: '', spotcheck: '', created_at: '',
    ...overrides,
  } as Trail
}

describe('SpotPanelTabs', () => {
  let store: ReturnType<typeof useSpotPanelStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSpotPanelStore()
  })

  it('always shows the Info tab button', () => {
    const wrapper = mount(SpotPanelTabs)
    expect(wrapper.find('[data-tab="info"]').exists()).toBe(true)
  })

  it('shows Tours/Trails buttons for a trail spot', () => {
    store.currentItem = trail({ type: 'trail' })
    const wrapper = mount(SpotPanelTabs)
    expect(wrapper.find('[data-tab="tours"]').exists()).toBe(true)
    expect(wrapper.find('[data-tab="trails"]').exists()).toBe(true)
  })

  it('hides Tours/Trails buttons for a bikepark/dirtpark spot', () => {
    store.currentItem = trail({ type: 'bikepark' } as Partial<Trail>)
    const wrapper = mount(SpotPanelTabs)
    expect(wrapper.find('[data-tab="tours"]').exists()).toBe(false)
    expect(wrapper.find('[data-tab="trails"]').exists()).toBe(false)
  })

  it('hides the Parking button when the spot has no parking and it is not force-visible', () => {
    store.currentItem = trail()
    store.parkingLots = []
    store.parkingTabForceVisible = false
    const wrapper = mount(SpotPanelTabs)
    expect(wrapper.find('[data-tab="parking"]').exists()).toBe(false)
  })

  it('shows the Parking button when the spot has parking lots', () => {
    store.currentItem = trail()
    store.parkingLots = [{ id: 'p1', name: 'Lot A', lat: 1, lng: 1 }]
    const wrapper = mount(SpotPanelTabs)
    expect(wrapper.find('[data-tab="parking"]').exists()).toBe(true)
  })

  it('shows the Parking button when force-visible even with no lots yet', () => {
    store.currentItem = trail()
    store.parkingLots = []
    store.parkingTabForceVisible = true
    const wrapper = mount(SpotPanelTabs)
    expect(wrapper.find('[data-tab="parking"]').exists()).toBe(true)
  })

  it('marks the active tab button per store.activeTab', () => {
    store.currentItem = trail()
    store.activeTab = 'trails'
    const wrapper = mount(SpotPanelTabs)
    expect(wrapper.get('[data-tab="trails"]').classes()).toContain('active')
    expect(wrapper.get('[data-tab="info"]').classes()).not.toContain('active')
  })

  it('clicking a tab button sets store.activeTab', async () => {
    store.currentItem = trail()
    const wrapper = mount(SpotPanelTabs)
    await wrapper.get('[data-tab="trails"]').trigger('click')
    expect(store.activeTab).toBe('trails')
  })
})
