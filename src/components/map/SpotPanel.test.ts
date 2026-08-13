import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'

// Covers SpotPanel.vue's own job — deriving pane/elevation visibility
// reactively off the store and wiring the drag handle — not the
// descendants' internals, which already have their own test files
// (SpotPanelHeader.test.ts, SpotPanelTabs.test.ts, etc.). Every child
// component is stubbed for that reason.
vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)

vi.mock('~/map/spot_panel/dragHandle', () => ({ initDragHandle: vi.fn() }))
import { initDragHandle } from '~/map/spot_panel/dragHandle'

import SpotPanel from './SpotPanel.vue'
import SpotPanelParkingTab from './SpotPanelParkingTab.vue'

function noop() {}

describe('SpotPanel', () => {
  let store: ReturnType<typeof useSpotPanelStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSpotPanelStore()
    vi.mocked(initDragHandle).mockReset()
  })

  function mountPanel() {
    return mount(SpotPanel, {
      props: { onHover: noop, onHoverEnd: noop },
      global: {
        stubs: {
          SpotPanelHeader: true,
          SpotPanelTabs: true,
          SpotPanelInfoTab: true,
          SpotPanelToursTab: true,
          SpotPanelTrailsTab: true,
          SpotPanelParkingTab: true,
          SpotPanelElevation: true,
        },
      },
    })
  }

  it('has the "open" class only when store.isOpen is true', async () => {
    const wrapper = mountPanel()
    expect(wrapper.get('.spot-panel').classes()).not.toContain('open')

    store.isOpen = true
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.spot-panel').classes()).toContain('open')
  })

  it('shows only the pane matching store.activeTab, keeping the others in the DOM with the hidden class', async () => {
    const wrapper = mountPanel()
    expect(wrapper.get('#spot-info-tab').classes()).not.toContain('hidden')
    expect(wrapper.get('#spot-tours-tab').classes()).toContain('hidden')
    expect(wrapper.get('#spot-trails-tab').classes()).toContain('hidden')
    expect(wrapper.get('#spot-parking-tab').classes()).toContain('hidden')

    store.setActiveTab('tours')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('#spot-info-tab').classes()).toContain('hidden')
    expect(wrapper.get('#spot-tours-tab').classes()).not.toContain('hidden')
  })

  it('hides the elevation panel until both selectedItemId and selectedItemKind are set', async () => {
    const wrapper = mountPanel()
    expect(wrapper.get('.spot-elevation-panel').classes()).toContain('hidden')

    store.selectItem('trail-1', 'trail')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.spot-elevation-panel').classes()).not.toContain('hidden')

    store.clearSelection()
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.spot-elevation-panel').classes()).toContain('hidden')
  })

  it('passes the parking store fields through to SpotPanelParkingTab as props', () => {
    store.parkingLots = [{ id: 'p1', name: 'Lot A', lat: 1, lng: 1 }]
    store.highlightedParkingLotId = 'p1'
    const wrapper = mountPanel()

    const parkingTab = wrapper.findComponent(SpotPanelParkingTab)
    expect(parkingTab.props('lots')).toEqual(store.parkingLots)
    expect(parkingTab.props('highlightId')).toBe('p1')
  })

  it('initializes the drag handle on mount', () => {
    mountPanel()
    expect(initDragHandle).toHaveBeenCalledTimes(1)
  })
})
