import { describe, it, expect } from 'vitest'
import { parkingHTML } from './spotPanelHtml'
import type { SpotParkingLot } from '../../communication/trails'

describe('parkingHTML', () => {
  it('shows an empty-state message when there are no lots', () => {
    const html = parkingHTML([])
    expect(html).toContain('spot-empty')
    expect(html).toContain('Keine Parkplätze')
  })

  it('renders the lot name plus all info entries', () => {
    const lot: SpotParkingLot = {
      id: 'p1', name: 'Main Lot', lat: 47.8, lng: 13.0,
      info: ['Gewichtsbeschränkung: 3.5t', 'Öffnungszeiten: 24/7', 'Kosten: Kostenlos'],
    }
    const html = parkingHTML([lot])
    expect(html).toContain('Main Lot')
    expect(html).toContain('Gewichtsbeschränkung: 3.5t')
    expect(html).toContain('Öffnungszeiten: 24/7')
    expect(html).toContain('Kosten: Kostenlos')
  })

  it('renders no info lines when the info array is empty or missing, never rendering "null"/"undefined"', () => {
    const lots: SpotParkingLot[] = [
      { id: 'p2', name: 'North Entrance', lat: 47.8, lng: 13.0, info: [] },
      { id: 'p3', name: 'South Entrance', lat: 47.9, lng: 13.1 },
    ]
    const html = parkingHTML(lots)
    expect(html).toContain('North Entrance')
    expect(html).toContain('South Entrance')
    expect(html).not.toContain('null')
    expect(html).not.toContain('undefined')
  })

  it('marks the highlighted lot as active and leaves others untouched', () => {
    const lots: SpotParkingLot[] = [
      { id: 'p1', name: 'Lot A', lat: 1, lng: 1 },
      { id: 'p2', name: 'Lot B', lat: 2, lng: 2 },
    ]
    const html = parkingHTML(lots, 'p2')
    const lotADiv = html.match(/<div class="spot-item[^"]*" data-id="p1"[^>]*>/)?.[0] ?? ''
    const lotBDiv = html.match(/<div class="spot-item[^"]*" data-id="p2"[^>]*>/)?.[0] ?? ''
    expect(lotADiv).not.toContain('active')
    expect(lotBDiv).toContain('active')
  })

  it('renders each lot with a "parking" data-kind so click handling can dispatch on it', () => {
    const lots: SpotParkingLot[] = [{ id: 'p1', name: 'Lot A', lat: 1, lng: 1 }]
    expect(parkingHTML(lots)).toContain('data-kind="parking"')
  })
})
