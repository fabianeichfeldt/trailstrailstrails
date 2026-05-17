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
