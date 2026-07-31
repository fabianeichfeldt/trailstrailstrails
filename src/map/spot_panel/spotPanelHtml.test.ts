import { describe, it, expect } from 'vitest'
import { parkingHTML, trailsHTML, trailStatusCardFor } from './spotPanelHtml'
import type { SpotParkingLot } from '../../communication/trails'
import type { MtbTrail, MtbTour } from '../../types/MtbTypes'

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

function baseTrail(overrides: Partial<MtbTrail> = {}): MtbTrail {
  return {
    id: 't1', spotId: 's1', name: 'Testtrail', difficulty: 'blue',
    distance_km: 3, elevation_gain: 100, elevation_loss: 300,
    direction: 'one-way-down', gpxPoints: [], elevationProfile: [],
    ...overrides,
  }
}

describe('trailsHTML — status row tint + tag', () => {
  it('renders no status tint or tag for an open trail', () => {
    const html = trailsHTML([baseTrail()])
    expect(html).not.toContain('trail-status-row-')
    expect(html).not.toContain('trail-status-tag')
  })

  it('tints the row and tags "Gesperrt" for a trail with an active closed_from', () => {
    const html = trailsHTML([baseTrail({ closed_from: '2000-01-01T00:00:00Z' })])
    expect(html).toContain('trail-status-row-closed')
    expect(html).toContain('trail-status-tag-closed')
    expect(html).toContain('Gesperrt')
  })

  it('tints the row and tags "Hinweis" for a future closed_from', () => {
    const html = trailsHTML([baseTrail({ closed_from: '2999-01-01T00:00:00Z' })])
    expect(html).toContain('trail-status-row-hint')
    expect(html).toContain('trail-status-tag-hint')
    expect(html).toContain('Hinweis')
  })

  it('tints the row and tags "Hinweis" for a hint with no schedule', () => {
    const html = trailsHTML([baseTrail({ hint: 'Erdrutsch, bitte umfahren' })])
    expect(html).toContain('trail-status-row-hint')
    expect(html).toContain('trail-status-tag-hint')
  })

  it('renders no tint or tag once an expired schedule has passed', () => {
    const html = trailsHTML([baseTrail({ closed_from: '2000-01-01T00:00:00Z', closed_to: '2000-02-01T00:00:00Z' })])
    expect(html).not.toContain('trail-status-row-')
    expect(html).not.toContain('trail-status-tag')
  })
})

function baseTour(overrides: Partial<MtbTour> = {}): MtbTour {
  return {
    id: 'tr1', spotId: 's1', name: 'Testtour',
    distance_km: 5, elevation_gain: 200, elevation_loss: 400,
    direction: 'cw', duration_minutes: 60, trailCount: 2,
    segments: [], gpxPoints: [], elevationProfile: [], hasFullGpx: true,
    ...overrides,
  }
}

describe('trailStatusCardFor', () => {
  it('returns null for an open trail (nothing to show in the elevation view)', () => {
    expect(trailStatusCardFor(baseTrail(), 'Waldkopf')).toBeNull()
  })

  it('returns null for a tour, even one that happens to share a trail id (tours have no status fields)', () => {
    expect(trailStatusCardFor(baseTour(), 'Waldkopf')).toBeNull()
  })

  it('returns a closed status card with the state class and Trailcrew attribution for a closed trail', () => {
    const el = trailStatusCardFor(baseTrail({ closed_from: '2000-01-01T00:00:00Z' }), 'Waldkopf')
    expect(el).not.toBeNull()
    expect(el!.className).toContain('trail-status-info-closed')
    expect(el!.textContent).toContain('Aktuell gesperrt')
    expect(el!.textContent).toContain('Hinweis von Trailcrew Waldkopf')
  })

  it('returns a closing-soon status card for a hint with no schedule', () => {
    const el = trailStatusCardFor(baseTrail({ hint: 'Erdrutsch, bitte umfahren' }), 'Waldkopf')
    expect(el).not.toBeNull()
    expect(el!.className).toContain('trail-status-info-closing')
    expect(el!.textContent).toContain('Erdrutsch, bitte umfahren')
  })
})
