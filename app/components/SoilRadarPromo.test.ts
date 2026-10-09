import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SoilRadarPromo from './SoilRadarPromo.vue'

const NuxtLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const mountPromo = () => mount(SoilRadarPromo, { global: { stubs: { NuxtLink } } })

describe('SoilRadarPromo', () => {
  it('links straight into the map with the radar switched on', () => {
    const w = mountPromo()
    expect(w.get('[data-testid="soil-promo-cta"]').attributes('href')).toBe('/map?radar=1')
    expect(w.get('h2').text()).toBe("Wo fährt's sich heute am besten?")
  })

  it('shows the real radar map as a decorative backdrop, credited to OpenStreetMap', () => {
    const w = mountPromo()
    const img = w.get('[data-testid="soil-promo-map"]')
    expect(img.attributes('src')).toBe('/assets/soil-radar-preview.webp')
    expect(img.attributes('alt')).toBe('')
    expect(w.text()).toContain('© OpenStreetMap')
  })

  it('names every level of the legend and that it is a Supporter feature', () => {
    const text = mountPromo().text()
    for (const label of ['Staubig', 'Trocken', 'Hero Dirt', 'Feucht', 'Schlammig']) expect(text).toContain(label)
    expect(text).toContain('Supporter-Funktion')
  })
})
