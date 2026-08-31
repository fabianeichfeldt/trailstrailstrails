import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import type { MtbTrail, SpotMtbData } from '~/types/MtbTypes'
import SpotPanelTrailsTab from './SpotPanelTrailsTab.vue'

// SpotPanelTrailsTab.vue relies on Nuxt's implicit auto-import of
// useSpotPanelStore — see vitest.setup.ts and SpotPanelComments.test.ts.
vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)

function baseTrail(overrides: Partial<MtbTrail> = {}): MtbTrail {
  return {
    id: 'trail-1', spotId: 's1', name: 'Testtrail', difficulty: 'blue',
    distance_km: 3, elevation_gain: 100, elevation_loss: 300,
    direction: 'one-way-down', gpxPoints: [], elevationProfile: [],
    ...overrides,
  }
}

function spotData(trails: MtbTrail[]): SpotMtbData {
  return { spotId: 's1', tours: [], trails }
}

describe('SpotPanelTrailsTab', () => {
  let store: ReturnType<typeof useSpotPanelStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSpotPanelStore()
  })

  it('shows an empty-state message when there is no data', () => {
    const wrapper = mount(SpotPanelTrailsTab)
    expect(wrapper.find('.spot-empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('Keine Trails')
  })

  it('renders the trail name, difficulty, GPX link and stats', () => {
    store.data = spotData([baseTrail({
      id: 't1', name: 'Flowtrail', gpx_url: 'https://example.com/t1.gpx',
      distance_km: 4.2, elevation_gain: 150, elevation_loss: 600, direction: 'one-way-down',
    })])
    const wrapper = mount(SpotPanelTrailsTab)
    expect(wrapper.text()).toContain('Flowtrail')
    // Distance is always shown in meters, not km.
    expect(wrapper.text()).toContain('4200 m')
    // The per-trail direction glyph was dropped as visual noise.
    expect(wrapper.find('.direction-tag').exists()).toBe(false)
    expect(wrapper.get('.spot-item-dl').attributes('href')).toBe('https://example.com/t1.gpx')
  })

  it('does not render a GPX link when the trail has none', () => {
    store.data = spotData([baseTrail({ gpx_url: undefined })])
    const wrapper = mount(SpotPanelTrailsTab)
    expect(wrapper.find('.spot-item-dl').exists()).toBe(false)
  })

  it('marks the selected trail as active and leaves other rows/kinds untouched', () => {
    store.data = spotData([baseTrail({ id: 't1' }), baseTrail({ id: 't2' })])
    store.selectedItemId = 't1'
    store.selectedItemKind = 'trail'
    const wrapper = mount(SpotPanelTrailsTab)
    expect(wrapper.get('[data-id="t1"]').classes()).toContain('active')
    expect(wrapper.get('[data-id="t2"]').classes()).not.toContain('active')
  })

  it('clicking a row calls store.selectItem with the trail id and kind "trail"', async () => {
    store.data = spotData([baseTrail({ id: 't1' })])
    const wrapper = mount(SpotPanelTrailsTab)
    await wrapper.get('[data-id="t1"]').trigger('click')
    expect(store.selectedItemId).toBe('t1')
    expect(store.selectedItemKind).toBe('trail')
  })

  // ── Status row tint + tag (ported from spotPanelHtml.test.ts) ──────────
  it('renders no status tint or tag for an open trail', () => {
    store.data = spotData([baseTrail()])
    const wrapper = mount(SpotPanelTrailsTab)
    expect(wrapper.get('.spot-item').classes().join(' ')).not.toContain('trail-status-row-')
    expect(wrapper.find('.trail-status-tag').exists()).toBe(false)
  })

  it('tints the row and tags "Gesperrt" for a trail with an active closed_from', () => {
    store.data = spotData([baseTrail({ closed_from: '2000-01-01T00:00:00Z' })])
    const wrapper = mount(SpotPanelTrailsTab)
    expect(wrapper.get('.spot-item').classes()).toContain('trail-status-row-closed')
    expect(wrapper.find('.trail-status-tag-closed').exists()).toBe(true)
    expect(wrapper.text()).toContain('Gesperrt')
  })

  it('tints the row and tags "Hinweis" for a future closed_from', () => {
    store.data = spotData([baseTrail({ closed_from: '2999-01-01T00:00:00Z' })])
    const wrapper = mount(SpotPanelTrailsTab)
    expect(wrapper.get('.spot-item').classes()).toContain('trail-status-row-hint')
    expect(wrapper.find('.trail-status-tag-hint').exists()).toBe(true)
    expect(wrapper.text()).toContain('Hinweis')
  })

  it('tints the row and tags "Hinweis" for a hint with no schedule', () => {
    store.data = spotData([baseTrail({ hint: 'Erdrutsch, bitte umfahren' })])
    const wrapper = mount(SpotPanelTrailsTab)
    expect(wrapper.get('.spot-item').classes()).toContain('trail-status-row-hint')
    expect(wrapper.find('.trail-status-tag-hint').exists()).toBe(true)
  })

  it('renders no tint or tag once an expired schedule has passed', () => {
    store.data = spotData([baseTrail({ closed_from: '2000-01-01T00:00:00Z', closed_to: '2000-02-01T00:00:00Z' })])
    const wrapper = mount(SpotPanelTrailsTab)
    expect(wrapper.get('.spot-item').classes().join(' ')).not.toContain('trail-status-row-')
    expect(wrapper.find('.trail-status-tag').exists()).toBe(false)
  })
})
