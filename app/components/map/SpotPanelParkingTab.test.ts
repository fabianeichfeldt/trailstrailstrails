import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SpotParkingLot } from '~/communication/trails'
import SpotPanelParkingTab from './SpotPanelParkingTab.vue'

// Ported 1:1 from the parkingHTML() describe block in
// app/map/spot_panel/spotPanelHtml.test.ts (deleted once this component's
// island replaces parkingHTML() as the live renderer — see spotPanel.ts).
describe('SpotPanelParkingTab', () => {
  it('shows an empty-state message when there are no lots', () => {
    const wrapper = mount(SpotPanelParkingTab, { props: { lots: [] } })
    expect(wrapper.find('.spot-empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('Keine Parkplätze')
  })

  it('renders the lot name plus all info entries', () => {
    const lot: SpotParkingLot = {
      id: 'p1', name: 'Main Lot', lat: 47.8, lng: 13.0,
      info: ['Gewichtsbeschränkung: 3.5t', 'Öffnungszeiten: 24/7', 'Kosten: Kostenlos'],
    }
    const wrapper = mount(SpotPanelParkingTab, { props: { lots: [lot] } })
    expect(wrapper.text()).toContain('Main Lot')
    expect(wrapper.text()).toContain('Gewichtsbeschränkung: 3.5t')
    expect(wrapper.text()).toContain('Öffnungszeiten: 24/7')
    expect(wrapper.text()).toContain('Kosten: Kostenlos')
  })

  it('renders no info lines when the info array is empty or missing, never rendering "null"/"undefined"', () => {
    const lots: SpotParkingLot[] = [
      { id: 'p2', name: 'North Entrance', lat: 47.8, lng: 13.0, info: [] },
      { id: 'p3', name: 'South Entrance', lat: 47.9, lng: 13.1 },
    ]
    const wrapper = mount(SpotPanelParkingTab, { props: { lots } })
    expect(wrapper.text()).toContain('North Entrance')
    expect(wrapper.text()).toContain('South Entrance')
    expect(wrapper.text()).not.toContain('null')
    expect(wrapper.text()).not.toContain('undefined')
  })

  it('marks the highlighted lot as active and leaves others untouched', () => {
    const lots: SpotParkingLot[] = [
      { id: 'p1', name: 'Lot A', lat: 1, lng: 1 },
      { id: 'p2', name: 'Lot B', lat: 2, lng: 2 },
    ]
    const wrapper = mount(SpotPanelParkingTab, { props: { lots, highlightId: 'p2' } })
    const lotA = wrapper.get('[data-id="p1"]')
    const lotB = wrapper.get('[data-id="p2"]')
    expect(lotA.classes()).not.toContain('active')
    expect(lotB.classes()).toContain('active')
  })

  it('renders each lot with a "parking" data-kind so click handling can dispatch on it', () => {
    const lots: SpotParkingLot[] = [{ id: 'p1', name: 'Lot A', lat: 1, lng: 1 }]
    const wrapper = mount(SpotPanelParkingTab, { props: { lots } })
    expect(wrapper.get('[data-id="p1"]').attributes('data-kind')).toBe('parking')
  })

  it('has no highlighted lot when highlightId is omitted', () => {
    const lots: SpotParkingLot[] = [{ id: 'p1', name: 'Lot A', lat: 1, lng: 1 }]
    const wrapper = mount(SpotPanelParkingTab, { props: { lots } })
    expect(wrapper.get('[data-id="p1"]').classes()).not.toContain('active')
  })

  it('clicking a lot emits flyTo with its coordinates and marks it active', async () => {
    const lots: SpotParkingLot[] = [
      { id: 'p1', name: 'Lot A', lat: 47.71, lng: 11.76 },
      { id: 'p2', name: 'Lot B', lat: 47.72, lng: 11.77 },
    ]
    const wrapper = mount(SpotPanelParkingTab, { props: { lots } })

    await wrapper.get('[data-id="p2"]').trigger('click')

    expect(wrapper.emitted('flyTo')).toEqual([[47.72, 11.77]])
    expect(wrapper.get('[data-id="p1"]').classes()).not.toContain('active')
    expect(wrapper.get('[data-id="p2"]').classes()).toContain('active')
  })
})
