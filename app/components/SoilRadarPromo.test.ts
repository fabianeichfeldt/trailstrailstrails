// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, ref } from 'vue'
import { mount } from '@vue/test-utils'
import SoilRadarPromo from './SoilRadarPromo.vue'

const variant = ref<string | null>(null)
vi.stubGlobal('useState', () => computed({ get: () => (variant.value ? { experimentId: 'radar-free-with-account', variant: variant.value } : null), set: () => {} }))
beforeEach(() => { variant.value = null })

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

  it('control keeps the Supporter fine print; B says free with an account', () => {
    expect(mountPromo().get('.fine').text()).toContain('Supporter-Funktion')
    variant.value = 'b'
    const fine = mountPromo().get('.fine').text()
    expect(fine).toBe('Kostenlos mit Konto. Ohne Konto siehst du eine Beispielansicht.')
    expect(fine).not.toContain('Supporter')
  })

  it('never renders "Stufe 0"', () => {
    for (const v of [null, 'a', 'b']) { variant.value = v; expect(mountPromo().text()).not.toContain('Stufe') }
  })
})
