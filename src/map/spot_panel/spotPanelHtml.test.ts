import { describe, it, expect } from 'vitest'
import { trailStatusCardFor } from './spotPanelHtml'
import type { MtbTrail, MtbTour } from '../../types/MtbTypes'

// trailStatusCardFor() returns an HTMLElement, not markup — Vue components
// that need it call it directly rather than reimplementing it.

function baseTrail(overrides: Partial<MtbTrail> = {}): MtbTrail {
  return {
    id: 't1', spotId: 's1', name: 'Testtrail', difficulty: 'blue',
    distance_km: 3, elevation_gain: 100, elevation_loss: 300,
    direction: 'one-way-down', gpxPoints: [], elevationProfile: [],
    ...overrides,
  }
}

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
