/** Zoom when centring on a single spot (opening it from search, `?trail=`, the spot page's mini-map). */
export const SPOT_ZOOM = 13
/** Zoom for a town / city / village picked from search. */
export const TOWN_ZOOM = 12
/** Zoom for a district or larger area, and the default for "fly to this point". */
export const REGION_ZOOM = 11

// Nominatim `addresstype` values that mean "an area, not a settlement".
const AREA_TYPES = new Set(['county', 'state_district', 'state', 'region', 'province', 'country', 'district'])

/** Nominatim result → zoom: settlements get TOWN_ZOOM, areas and unknown types stay at REGION_ZOOM. */
export function zoomForPlace(place: { addresstype?: string; type?: string }): number {
  const kind = place.addresstype ?? place.type
  if (!kind || AREA_TYPES.has(kind)) return REGION_ZOOM
  return TOWN_ZOOM
}
