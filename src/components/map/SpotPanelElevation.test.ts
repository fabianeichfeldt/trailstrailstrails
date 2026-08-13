import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import type { MtbTrail, MtbTour, SpotMtbData } from '~/types/MtbTypes'
import SpotPanelElevation from './SpotPanelElevation.vue'

// SpotPanelElevation.vue relies on Nuxt's implicit auto-import of
// useSpotPanelStore — see vitest.setup.ts and SpotPanelComments.test.ts.
vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)

function baseTrail(overrides: Partial<MtbTrail> = {}): MtbTrail {
  return {
    id: 'trail-1', spotId: 's1', name: 'Testtrail', difficulty: 'blue',
    distance_km: 3, elevation_gain: 100, elevation_loss: 300,
    direction: 'one-way-down',
    gpxPoints: [[47.7, 11.7, 700], [47.71, 11.71, 750]],
    elevationProfile: [{ dist: 0, alt: 700 }, { dist: 1, alt: 750 }],
    ...overrides,
  }
}

function baseTour(overrides: Partial<MtbTour> = {}): MtbTour {
  return {
    id: 'tour-1', spotId: 's1', name: 'Testtour',
    distance_km: 5, elevation_gain: 200, elevation_loss: 400,
    direction: 'cw', duration_minutes: 60, trailCount: 2,
    segments: [], hasFullGpx: true,
    gpxPoints: [[47.7, 11.7, 700], [47.71, 11.71, 750]],
    elevationProfile: [{ dist: 0, alt: 700 }, { dist: 1, alt: 750 }],
    ...overrides,
  }
}

function spotData(overrides: Partial<SpotMtbData> = {}): SpotMtbData {
  return { spotId: 's1', tours: [baseTour()], trails: [baseTrail()], ...overrides }
}

function mountElevation(props: Partial<{ onHover: any; onHoverEnd: any }> = {}) {
  return mount(SpotPanelElevation, {
    props: {
      onHover: props.onHover ?? vi.fn(),
      onHoverEnd: props.onHoverEnd ?? vi.fn(),
    },
  })
}

describe('SpotPanelElevation', () => {
  let store: ReturnType<typeof useSpotPanelStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSpotPanelStore()
  })

  it('renders nothing item-specific when no item is selected', () => {
    const wrapper = mountElevation()
    expect(wrapper.get('.spot-elevation-name').text()).toBe('')
    expect(wrapper.find('.spot-elevation-stats').exists()).toBe(false)
    expect(wrapper.find('.spot-elevation-download').exists()).toBe(false)
  })

  it('shows the trail name, stats, direction and an SVG chart for a selected trail', () => {
    store.data = spotData()
    store.selectedItemId = 'trail-1'
    store.selectedItemKind = 'trail'
    const wrapper = mountElevation()

    expect(wrapper.get('.spot-elevation-name').text()).toBe('Testtrail')
    const stats = wrapper.get('.spot-elevation-stats').text()
    expect(stats).toContain('3 km')
    expect(stats).toContain('100 m')
    expect(stats).toContain('300 m')
    expect(stats).toContain('Nur bergab')
    expect(wrapper.find('.spot-elevation-chart svg').exists()).toBe(true)
  })

  it('shows a GPX download link when the item has one, none otherwise', () => {
    store.data = spotData({ trails: [baseTrail({ gpx_url: 'https://example.com/t.gpx' })] })
    store.selectedItemId = 'trail-1'
    store.selectedItemKind = 'trail'
    const wrapper = mountElevation()
    const link = wrapper.get('.spot-elevation-download')
    expect(link.attributes('href')).toBe('https://example.com/t.gpx')
    expect(link.attributes('download')).toBe('Testtrail.gpx')
  })

  it('shows tour stats for a selected tour', () => {
    store.data = spotData()
    store.selectedItemId = 'tour-1'
    store.selectedItemKind = 'tour'
    const wrapper = mountElevation()
    expect(wrapper.get('.spot-elevation-name').text()).toBe('Testtour')
    expect(wrapper.find('.spot-elevation-chart svg').exists()).toBe(true)
  })

  it('clicking close clears the store selection', async () => {
    store.data = spotData()
    store.selectedItemId = 'trail-1'
    store.selectedItemKind = 'trail'
    const wrapper = mountElevation()

    await wrapper.get('.spot-elevation-close').trigger('click')
    expect(store.selectedItemId).toBeNull()
    expect(store.selectedItemKind).toBeNull()
  })

  it('binds hover on the mounted SVG and calls onHover on mousemove', async () => {
    const onHover = vi.fn()
    store.data = spotData()
    store.selectedItemId = 'trail-1'
    store.selectedItemKind = 'trail'
    const wrapper = mountElevation({ onHover })
    await flushPromises()

    const svg = wrapper.get('.spot-elevation-chart svg').element as unknown as SVGSVGElement
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 300, height: 88, right: 300, bottom: 88, x: 0, y: 0, toJSON() {},
    } as DOMRect)

    svg.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 40 }))
    expect(onHover).toHaveBeenCalled()
  })

  it('shows the trail-status card for a closed trail, none for an open one', async () => {
    store.data = spotData({ trails: [baseTrail({ closed_from: '2000-01-01T00:00:00Z' })] })
    store.currentItem = { id: 's1', name: 'Waldkopf', type: 'trail', latitude: 1, longitude: 1, approved: true } as any
    store.selectedItemId = 'trail-1'
    store.selectedItemKind = 'trail'
    const wrapper = mountElevation()
    await flushPromises()

    expect(wrapper.find('.trail-status-info-closed').exists()).toBe(true)
    expect(wrapper.text()).toContain('Aktuell gesperrt')
    expect(wrapper.text()).toContain('Hinweis von Trailcrew Waldkopf')
  })

  it('shows no trail-status card for an open trail', async () => {
    store.data = spotData()
    store.selectedItemId = 'trail-1'
    store.selectedItemKind = 'trail'
    const wrapper = mountElevation()
    await flushPromises()

    expect(wrapper.find('.spot-elevation-status').element.innerHTML).toBe('')
  })

  it('shows no trail-status card for a tour, even a closed-schedule one', async () => {
    store.data = spotData()
    store.selectedItemId = 'tour-1'
    store.selectedItemKind = 'tour'
    const wrapper = mountElevation()
    await flushPromises()

    expect(wrapper.find('.spot-elevation-status').element.innerHTML).toBe('')
  })
})
