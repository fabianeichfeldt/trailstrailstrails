import { describe, it, expect } from 'vitest'
import { trailsHTML, trailStatusCardFor } from './spotPanelHtml'
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
