import { describe, it, expect } from 'vitest'
import { parkingHTML } from './spotPanelHtml'
import type { SpotParkingLot } from '../../communication/trails'

describe('parkingHTML', () => {
  it('shows an empty-state message when there are no lots', () => {
    const html = parkingHTML([])
    expect(html).toContain('spot-empty')
    expect(html).toContain('Keine Parkplätze')
  })

  it('renders the lot name plus all populated hint fields', () => {
    const lot: SpotParkingLot = {
      id: 'p1', name: 'Main Lot', lat: 47.8, lng: 13.0,
      weight_limit_hint: '3.5t', opening_hours_hint: '24/7',
      cost_hint: 'Kostenlos', charging_hint: 'Keine',
    }
    const html = parkingHTML([lot])
    expect(html).toContain('Main Lot')
    expect(html).toContain('3.5t')
    expect(html).toContain('24/7')
    expect(html).toContain('Kostenlos')
    expect(html).toContain('Keine')
  })

  it('omits hint lines cleanly for null/empty fields, never rendering the literal "null"', () => {
    const lot: SpotParkingLot = {
      id: 'p2', name: 'North Entrance', lat: 47.8, lng: 13.0,
      weight_limit_hint: undefined, opening_hours_hint: '', cost_hint: undefined, charging_hint: undefined,
    }
    const html = parkingHTML([lot])
    expect(html).toContain('North Entrance')
    expect(html).not.toContain('null')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('Gewichtsbeschränkung')
    expect(html).not.toContain('Öffnungszeiten')
    expect(html).not.toContain('Kosten')
    expect(html).not.toContain('Lademöglichkeit')
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
