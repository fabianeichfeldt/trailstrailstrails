export interface LatLng {
  lat: number
  lng: number
}

/** Rounds a coordinate to 6 decimal places (~11 cm precision) for storage. */
export function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6
}
