import type { TrailStatusState } from '../types/TrailStatus'

export interface MarkerIconOptions {
  html: string
  iconSize: [number, number]
  iconAnchor: [number, number]
  popupAnchor: [number, number]
  className: string
}

export function markerIconOptions(type: string, approved: boolean): MarkerIconOptions {
  const category =
    type === 'dirtpark' ? 'dirtpark' :
    type === 'bikepark' ? 'bikepark' :
    approved           ? 'verified' : 'unverified'

  return {
    html:        `<div class="map-pin map-pin-${category}"></div>`,
    iconSize:    [18, 18],
    iconAnchor:  [9, 22],
    popupAnchor: [0, -24],
    className:   '',
  }
}

/**
 * Circular "P" badge for parking lots — deliberately not the teardrop
 * .map-pin shape used for spots, so it reads as a secondary/auxiliary
 * marker. Shared by the main map, the SpotManager parking list, and the
 * parking editor's location picker so the icon is identical everywhere.
 */
export function parkingIconOptions(): MarkerIconOptions {
  return {
    html:        `<div class="parking-pin">P</div>`,
    iconSize:    [22, 22],
    iconAnchor:  [11, 11],
    popupAnchor: [0, -14],
    className:   '',
  }
}

/**
 * Glossy status badge for a GPX trail track, shown at the track's midpoint
 * when its derived status (see src/types/TrailStatus.ts) is 'closing_soon'
 * or 'closed'. Additive only — never used for the 'open' state, and never
 * touches the track's difficulty-color line rendering.
 *
 * iconSize (36x36) is a padded tap target, larger than the visible dot
 * (20x20, styled via .trail-status-badge) — className centers the dot inside
 * via flex so the touch target stays generous without the badge looking big.
 */
export function trailStatusBadgeOptions(state: Exclude<TrailStatusState, 'open'>): MarkerIconOptions {
  const variant = state === 'closed' ? 'closed' : 'closing'
  const glyph   = state === 'closed' ? '✕' : 'i'

  return {
    html:        `<div class="trail-status-badge trail-status-badge-${variant}">${glyph}</div>`,
    iconSize:    [36, 36],
    iconAnchor:  [18, 18],
    popupAnchor: [0, -20],
    className:   'trail-status-hit',
  }
}
