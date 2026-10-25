import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RegionSpotList from './RegionSpotList.vue'

const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const spots = [
  { slug: 'neuland', name: 'Neuland', type: 'trail' as const, approved: true, distanceKm: 1 },
  { slug: 'park', name: 'Park', type: 'bikepark' as const, approved: false, distanceKm: 2 },
]

describe('RegionSpotList', () => {
  it('renders crawlable trailing-slash links, type labels and the official badge', () => {
    const w = mount(RegionSpotList, { props: { spots, heading: '2 MTB-Spots' }, global: { stubs: { NuxtLink } } })
    const links = w.findAll('a')
    expect(links.map(a => a.attributes('href'))).toEqual(['/trails/neuland/', '/trails/park/'])
    expect(links[0]!.text()).toContain('Trail')
    expect(links[1]!.text()).toContain('Bikepark')
    expect(links[0]!.text()).toContain('offiziell')
    expect(links[1]!.text()).not.toContain('offiziell')
  })
  it('renders nothing without spots', () => {
    const w = mount(RegionSpotList, { props: { spots: [], heading: '' }, global: { stubs: { NuxtLink } } })
    expect(w.find('section').exists()).toBe(false)
  })
})
