import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import type { MtbTour, SpotMtbData } from '~/types/MtbTypes'
import SpotPanelToursTab from './SpotPanelToursTab.vue'

// SpotPanelToursTab.vue relies on Nuxt's implicit auto-import of
// useSpotPanelStore — see vitest.setup.ts and SpotPanelComments.test.ts for
// the same pattern.
vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)

function baseTour(overrides: Partial<MtbTour> = {}): MtbTour {
  return {
    id: 'tour-1', spotId: 's1', name: 'Testtour',
    distance_km: 5, elevation_gain: 200, elevation_loss: 400,
    direction: 'cw', duration_minutes: 60, trailCount: 2,
    segments: [], gpxPoints: [], elevationProfile: [], hasFullGpx: true,
    ...overrides,
  }
}

function spotData(tours: MtbTour[]): SpotMtbData {
  return { spotId: 's1', tours, trails: [] }
}

describe('SpotPanelToursTab', () => {
  let store: ReturnType<typeof useSpotPanelStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSpotPanelStore()
  })

  it('shows an empty-state message when there is no data', () => {
    const wrapper = mount(SpotPanelToursTab)
    expect(wrapper.find('.spot-empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('Keine Touren')
  })

  it('shows an empty-state message when the spot has no tours', () => {
    store.data = spotData([])
    const wrapper = mount(SpotPanelToursTab)
    expect(wrapper.find('.spot-empty').exists()).toBe(true)
  })

  it('renders the tour name, GPX link, trail count/duration and stats', () => {
    store.data = spotData([baseTour({
      id: 't1', name: 'Alpencross', gpx_url: 'https://example.com/t1.gpx',
      trailCount: 3, duration_minutes: 90, distance_km: 12.5, elevation_gain: 500, elevation_loss: 480,
    })])
    const wrapper = mount(SpotPanelToursTab)
    expect(wrapper.text()).toContain('Alpencross')
    expect(wrapper.text()).toContain('3 Trails · 90 min')
    expect(wrapper.text()).toContain('12.5 km')
    expect(wrapper.get('.spot-item-dl').attributes('href')).toBe('https://example.com/t1.gpx')
  })

  it('does not render a GPX link when the tour has none', () => {
    store.data = spotData([baseTour({ gpx_url: undefined })])
    const wrapper = mount(SpotPanelToursTab)
    expect(wrapper.find('.spot-item-dl').exists()).toBe(false)
  })

  it('renders a deduplicated IMBA dot per distinct trail-segment difficulty', () => {
    store.data = spotData([baseTour({
      segments: [
        { type: 'trail', difficulty: 'blue', gpxPoints: [] },
        { type: 'trail', difficulty: 'blue', gpxPoints: [] },
        { type: 'trail', difficulty: 'red', gpxPoints: [] },
        { type: 'transfer', gpxPoints: [] },
      ],
    })])
    const wrapper = mount(SpotPanelToursTab)
    expect(wrapper.findAll('.imba-dot')).toHaveLength(2)
  })

  it('marks the selected tour as active and leaves other rows/kinds untouched', () => {
    store.data = spotData([baseTour({ id: 't1' }), baseTour({ id: 't2' })])
    store.selectedItemId = 't1'
    store.selectedItemKind = 'tour'
    const wrapper = mount(SpotPanelToursTab)
    expect(wrapper.get('[data-id="t1"]').classes()).toContain('active')
    expect(wrapper.get('[data-id="t2"]').classes()).not.toContain('active')
  })

  it('does not mark a tour active when the same id is selected under kind "trail"', () => {
    store.data = spotData([baseTour({ id: 't1' })])
    store.selectedItemId = 't1'
    store.selectedItemKind = 'trail'
    const wrapper = mount(SpotPanelToursTab)
    expect(wrapper.get('[data-id="t1"]').classes()).not.toContain('active')
  })

  it('clicking a row calls store.selectItem with the tour id and kind "tour"', async () => {
    store.data = spotData([baseTour({ id: 't1' })])
    const wrapper = mount(SpotPanelToursTab)
    await wrapper.get('[data-id="t1"]').trigger('click')
    expect(store.selectedItemId).toBe('t1')
    expect(store.selectedItemKind).toBe('tour')
  })

  it('renders each row with a "tour" data-kind so click handling can dispatch on it', () => {
    store.data = spotData([baseTour({ id: 't1' })])
    const wrapper = mount(SpotPanelToursTab)
    expect(wrapper.get('[data-id="t1"]').attributes('data-kind')).toBe('tour')
  })
})
