export interface MarkerIconOptions {
  html: string
  iconSize: [number, number]
  iconAnchor: [number, number]
  popupAnchor: [number, number]
  shadowUrl: string
  className: string
}

export function markerIconOptions(type: string, approved: boolean): MarkerIconOptions {
  const category =
    type === 'dirtpark' ? 'dirtpark' :
    type === 'bikepark' ? 'bikepark' :
    approved           ? 'verified' : 'unverified'

  return {
    html: `<div class="marker-wrapper marker-${category}"><img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png" class="marker-img" /></div>`,
    iconSize:    [25, 41],
    iconAnchor:  [12, 41],
    popupAnchor: [1, -34],
    shadowUrl:   'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    className:   '',
  }
}
