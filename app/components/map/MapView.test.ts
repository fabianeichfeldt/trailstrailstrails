import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive, ref, watch, watchEffect, nextTick } from 'vue'
import MapView from './MapView.vue'

const filters = reactive({ grayscaleMap: true })
const soil = reactive({ enabled: false })
vi.stubGlobal('useFiltersStore', () => filters)
vi.stubGlobal('useSoilRadarStore', () => soil)
vi.stubGlobal('watch', watch)
vi.stubGlobal('watchEffect', watchEffect)
vi.stubGlobal('ref', ref)
vi.stubGlobal('useTrailMap', () => ({
  openTrail() {}, flyToPlace() {}, getCenter: () => null,
  nearbyConflict: ref(null), addSpotPicked: ref(null), mapReady: ref(false),
  soilCounts: ref({ matchCount: 0, totalCount: 0 }),
}))

describe('MapView container classes', () => {
  it('toggling the radar / grayscale keeps the classes Leaflet put on the container', async () => {
    const w = mount(MapView)
    const el = w.get('[data-testid="map-container"]').element
    el.classList.add('leaflet-container') // what L.map() does after mount
    await nextTick()
    expect(el.classList.contains('map-grayscale')).toBe(true)

    soil.enabled = true
    await nextTick()
    expect(el.classList.contains('soil-radar-on')).toBe(true)
    expect(el.classList.contains('leaflet-container')).toBe(true)

    filters.grayscaleMap = false
    soil.enabled = false
    await nextTick()
    expect(el.classList.contains('leaflet-container')).toBe(true)
    expect(el.classList.contains('map-grayscale')).toBe(false)
    expect(el.classList.contains('soil-radar-on')).toBe(false)
  })
})
