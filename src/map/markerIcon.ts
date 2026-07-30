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
