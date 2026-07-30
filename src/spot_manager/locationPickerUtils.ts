/**
 * Pure helpers for LocationPicker.vue's click-to-place / drag-to-place logic,
 * extracted so they're unit-testable without mounting a real Leaflet map in
 * jsdom (no precedent in this codebase for that — same spirit as the pure
 * functions in GpxProcessor.ts).
 */

export interface LatLng {
  lat: number
  lng: number
}

/** Leaflet click/drag events carry a `latlng` object with this shape. */
export interface LeafletLatLngEvent {
  latlng: { lat: number; lng: number }
}

/** Rounds a coordinate to 6 decimal places (~11 cm precision) for storage. */
export function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/** Converts a Leaflet map click (or marker drag) event into a stored LatLng. */
export function clickEventToLatLng(e: LeafletLatLngEvent): LatLng {
  return { lat: roundCoord(e.latlng.lat), lng: roundCoord(e.latlng.lng) }
}
