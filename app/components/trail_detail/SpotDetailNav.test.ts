import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Trail } from '~/types/Trail'
import SpotDetailNav from './SpotDetailNav.vue'

// Ported from SpotPanelTabs.test.ts as part of the spot-detail-real-pages
// rework — SpotDetailNav.vue is a sticky jump-link bar into page sections
// (long scroll, Decision 3/4 of the spec), not a tab-switcher: it's
// props-driven, has no "active" state, and no force-visible concept (the
// old openParkingLot()'s jump-to-parking-before-it-loads case no longer
// exists — the page always fetches parking on load).
function trail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: 't1', name: 'Flowtrail Tegernsee', type: 'trail',
    latitude: 1, longitude: 1, approved: true, url: '',
    creator: '', instagram: '', spotcheck: '', created_at: '',
    ...overrides,
  } as Trail
}

describe('SpotDetailNav', () => {
  it('always shows the Info link', () => {
    const wrapper = mount(SpotDetailNav, { props: { trail: trail(), parkingCount: 0 } })
    expect(wrapper.find('a[href="#description"]').exists()).toBe(true)
  })

  it('always shows the Kommentare link', () => {
    const wrapper = mount(SpotDetailNav, { props: { trail: trail(), parkingCount: 0 } })
    expect(wrapper.find('a[href="#comments"]').exists()).toBe(true)
  })

  it('shows Touren/Trails links for a trail spot', () => {
    const wrapper = mount(SpotDetailNav, { props: { trail: trail({ type: 'trail' }), parkingCount: 0 } })
    expect(wrapper.find('a[href="#touren"]').exists()).toBe(true)
    expect(wrapper.find('a[href="#trails"]').exists()).toBe(true)
  })

  it('hides Touren/Trails links for a bikepark/dirtpark spot', () => {
    const wrapper = mount(SpotDetailNav, { props: { trail: trail({ type: 'bikepark' } as Partial<Trail>), parkingCount: 0 } })
    expect(wrapper.find('a[href="#touren"]').exists()).toBe(false)
    expect(wrapper.find('a[href="#trails"]').exists()).toBe(false)
  })

  it('hides the Parkplätze link when the spot has no parking lots', () => {
    const wrapper = mount(SpotDetailNav, { props: { trail: trail(), parkingCount: 0 } })
    expect(wrapper.find('a[href="#parking"]').exists()).toBe(false)
  })

  it('shows the Parkplätze link when the spot has parking lots', () => {
    const wrapper = mount(SpotDetailNav, { props: { trail: trail(), parkingCount: 2 } })
    expect(wrapper.find('a[href="#parking"]').exists()).toBe(true)
  })
})
