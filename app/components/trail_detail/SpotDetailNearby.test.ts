import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { NearbySpot } from '@@/build/nearby'
import SpotDetailNearby from './SpotDetailNearby.vue'

// NuxtLink isn't registered outside a live Nuxt app — stub it with a plain
// anchor that passes `to` through as `href` so the link targets can be
// asserted (same trick as the routed spot-detail page uses).
const NuxtLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
}

function mountWith(spots: NearbySpot[]) {
  return mount(SpotDetailNearby, {
    props: { spots },
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  })
}

const withPhoto: NearbySpot = { id: 'a1', name: 'Alpha Trail', type: 'trail', km: 2.4, photo: 'https://example.com/a.jpg' }
const noPhoto: NearbySpot = { id: 'b2', name: 'Bravo Bikepark', type: 'bikepark', km: 12.7 }

describe('SpotDetailNearby', () => {
  it('renders one card per spot with a /trails/{id} link', () => {
    const wrapper = mountWith([withPhoto, noPhoto])
    const links = wrapper.findAll('a.nearby-card')
    expect(links).toHaveLength(2)
    expect(links[0].attributes('href')).toBe('/trails/a1')
    expect(links[1].attributes('href')).toBe('/trails/b2')
  })

  it('renders an <img> with the photo url when a photo is present', () => {
    const wrapper = mountWith([withPhoto])
    const img = wrapper.find('img.nearby-thumb')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/a.jpg')
  })

  it('falls back to the branded stand-in image when the spot has no photo', () => {
    const wrapper = mountWith([noPhoto])
    const img = wrapper.find('img.nearby-thumb')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('/assets/nearby-fallback.webp')
    expect(img.classes()).toContain('is-fallback')
  })

  it('shows the distance and type label', () => {
    const wrapper = mountWith([noPhoto])
    expect(wrapper.text()).toContain('Bravo Bikepark')
    expect(wrapper.text()).toContain('12,7 km entfernt')
  })

  it('renders nothing when the spots list is empty', () => {
    const wrapper = mountWith([])
    expect(wrapper.find('#nearby').exists()).toBe(false)
  })

  it('lays the cards out in a single scrollable carousel track with prev/next controls', () => {
    const wrapper = mountWith([withPhoto, noPhoto])
    const track = wrapper.find('.nearby-track')
    expect(track.exists()).toBe(true)
    expect(track.findAll('.nearby-item')).toHaveLength(2)
    // Controls are always in the DOM (v-show toggles visibility as the row scrolls).
    expect(wrapper.find('.nearby-arrow-prev').exists()).toBe(true)
    expect(wrapper.find('.nearby-arrow-next').exists()).toBe(true)
  })
})
