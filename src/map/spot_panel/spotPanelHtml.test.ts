import { describe, it, expect } from 'vitest'
import { trailStatusCardFor } from './spotPanelHtml'
import type { MtbTrail, MtbTour } from '../../types/MtbTypes'

// parkingHTML() and its tests were removed here — superseded by the
// SpotPanelParkingTab.vue island (src/components/map/SpotPanelParkingTab.vue,
// tested in SpotPanelParkingTab.test.ts) as part of the spot-panel Vue
// migration, Phase 1 (see docs/superpowers/specs/2026-08-13-spot-panel-vue-migration-design.md).
//
// commentsHTML() and its tests were removed here — superseded by the
// SpotPanelComments.vue island (src/components/map/SpotPanelComments.vue,
// tested in SpotPanelComments.test.ts) as part of the spot-panel Vue
// migration, Phase 2 (see the same spec).
//
// toursHTML()/trailsHTML() and their tests (including the "status row tint +
// tag" block that used to live here) were removed here — superseded by the
// SpotPanelToursTab.vue / SpotPanelTrailsTab.vue islands (tested in
// SpotPanelToursTab.test.ts / SpotPanelTrailsTab.test.ts) as part of the
// spot-panel Vue migration, Phase 3 (see the same spec). trailStatusCardFor()
// stays here — it returns an HTMLElement (not markup), so SpotPanelElevation.vue
// still calls it directly as an escape hatch rather than reimplementing it.

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
