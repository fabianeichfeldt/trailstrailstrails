import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import type { Trail } from '~/types/Trail'
import type { SpotMtbData } from '~/types/MtbTypes'

// app/map/miniMap.ts is browser-bound (Leaflet). Mock it entirely and assert
// the component wires props → createMiniMap / handle correctly.
const handle = {
  flyTo: vi.fn(),
  setData: vi.fn(),
  destroy: vi.fn(),
}
const createMiniMap = vi.fn(async () => handle)
vi.mock('~/map/miniMap', () => ({ createMiniMap: (...a: unknown[]) => createMiniMap(...a) }))

vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)

import SpotDetailMiniMap from './SpotDetailMiniMap.vue'

function trail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: 't1', slug: 't1', name: 'Flowtrail Tegernsee', type: 'trail',
    latitude: 47.71, longitude: 11.76, approved: true, url: '',
    creator: '', instagram: '', spotcheck: '', created_at: '',
    ...overrides,
  } as Trail
}

function mtbData(): SpotMtbData {
  return {
    spotId: 't1',
    tours: [
      { id: 'to1', spotId: 't1', name: 'Rundtour', gpxPoints: [[47.7, 11.7, 0], [47.71, 11.71, 0]] } as any,
    ],
    trails: [
      { id: 'gt1', spotId: 't1', name: 'Talabfahrt', difficulty: 'blue', gpxPoints: [[47.71, 11.76, 0], [47.716, 11.766, 0]] } as any,
      { id: 'gt2', spotId: 't1', name: 'Steilstück', difficulty: 'red', gpxPoints: [[47.72, 11.77, 0], [47.724, 11.774, 0]] } as any,
    ],
  }
}

function mountMap(props: Partial<InstanceType<typeof SpotDetailMiniMap>['$props']> = {}) {
  return mount(SpotDetailMiniMap, {
    props: {
      spot: trail(),
      data: null,
      parking: [],
      focus: null,
      ...props,
    },
  })
}

describe('SpotDetailMiniMap', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    createMiniMap.mockClear()
    handle.flyTo.mockClear()
    handle.setData.mockClear()
    handle.destroy.mockClear()
  })

  it('renders a stable placeholder div with the test hooks', () => {
    const wrapper = mountMap()
    const el = wrapper.get('[data-testid="spot-minimap"]')
    expect(el.classes()).toContain('trail-map')
    // No fly target before the map inits.
    expect(el.attributes('data-fly')).toBeUndefined()
  })

  it('seeds data-fly with the spot centre once the map inits', async () => {
    const wrapper = mountMap()
    await flushPromises()
    expect(wrapper.get('[data-testid="spot-minimap"]').attributes('data-fly')).toBe('47.71,11.76,11')
  })

  it('calls createMiniMap once on mount with interactive:true and the spot centre', async () => {
    mountMap({ data: mtbData() })
    await flushPromises()

    expect(createMiniMap).toHaveBeenCalledTimes(1)
    const [, input, options] = createMiniMap.mock.calls[0] as [unknown, any, any]
    expect(options.interactive).toBe(true)
    expect(input.center).toEqual([47.71, 11.76])
    expect(input.zoom).toBe(11)
    // 1 tour + 2 trails
    expect(input.polylines).toHaveLength(3)
    expect(input.polylines.filter((p: any) => p.kind === 'tour')).toHaveLength(1)
    // spot marker only (no parking passed)
    expect(input.markers).toHaveLength(1)
    expect(input.markers[0].kind).toBe('spot')
  })

  it('includes one parking marker per lot', async () => {
    mountMap({ parking: [{ id: 'p1', name: 'Talstation', lat: 47.709, lng: 11.758 }] })
    await flushPromises()
    const [, input] = createMiniMap.mock.calls[0] as [unknown, any]
    expect(input.markers).toHaveLength(2)
    expect(input.markers[1]).toMatchObject({ kind: 'parking', lat: 47.709, lng: 11.758, name: 'Talstation' })
  })

  it('wires onPolylineActivate to spotPanelStore.selectItem', async () => {
    mountMap({ data: mtbData() })
    await flushPromises()
    const store = useSpotPanelStore()
    const [, , options] = createMiniMap.mock.calls[0] as [unknown, unknown, any]

    options.onPolylineActivate({ id: 'gt1', kind: 'trail' })
    expect(store.selectedItemId).toBe('gt1')
    expect(store.selectedItemKind).toBe('trail')
  })

  it('re-renders layers via handle.setData when data arrives', async () => {
    const wrapper = mountMap()
    await flushPromises()
    handle.setData.mockClear()

    await wrapper.setProps({ data: mtbData() })
    await flushPromises()

    expect(handle.setData).toHaveBeenCalledTimes(1)
    expect(handle.setData.mock.calls[0][0].polylines).toHaveLength(3)
  })

  it('flies to a focus target, and back to the spot at zoom 11 when focus clears', async () => {
    const wrapper = mountMap()
    await flushPromises()

    await wrapper.setProps({ focus: { lat: 47.713, lng: 11.763 } })
    expect(handle.flyTo).toHaveBeenLastCalledWith(47.713, 11.763, 14)
    expect(wrapper.get('[data-testid="spot-minimap"]').attributes('data-fly')).toBe('47.713,11.763,14')

    await wrapper.setProps({ focus: null })
    expect(handle.flyTo).toHaveBeenLastCalledWith(47.71, 11.76, 11)
    expect(wrapper.get('[data-testid="spot-minimap"]').attributes('data-fly')).toBe('47.71,11.76,11')
  })

  it('honours an explicit focus zoom', async () => {
    const wrapper = mountMap()
    await flushPromises()
    await wrapper.setProps({ focus: { lat: 1, lng: 2, zoom: 16 } })
    expect(handle.flyTo).toHaveBeenLastCalledWith(1, 2, 16)
  })

  it('destroys the map handle on unmount', async () => {
    const wrapper = mountMap()
    await flushPromises()
    wrapper.unmount()
    expect(handle.destroy).toHaveBeenCalledTimes(1)
  })

  it('destroys immediately if unmounted before createMiniMap resolves', async () => {
    const wrapper = mountMap()
    wrapper.unmount()
    await flushPromises()
    expect(handle.destroy).toHaveBeenCalled()
  })

  it('guards map init behind an import.meta.server check', () => {
    const src = readFileSync(`${process.cwd()}/app/components/trail_detail/SpotDetailMiniMap.vue`, 'utf8')
    expect(src).toMatch(/if \(import\.meta\.server/)
  })
})
