// Build-time "Nearby Spots" computation. Pure, no I/O — the nitro:config
// hook in nuxt.config.ts feeds it the spot list it already fetches for
// prerender/sitemap and writes the result to public/nearby.json, which the
// trails/[slug] page loads at runtime (see SpotDetailNearby.vue).
//
// Kept in build/ (not app/) because it runs only at build time and app/
// code imports nothing from it except the NearbySpot type — an established
// pattern, same as the page importing `regions` from build/region.

export type SpotType = 'trail' | 'bikepark' | 'dirtpark'

export interface SpotLite {
  id: string
  name: string
  latitude: number
  longitude: number
  type: SpotType
  approved: boolean
}

export interface NearbySpot {
  id: string
  name: string
  type: SpotType
  km: number
  photo?: string
}

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Great-circle distance between two points in kilometres (haversine).
 */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

interface ComputeNearbyOptions {
  count?: number
  maxKm?: number
  photoBySpotId?: Record<string, string>
}

/**
 * For every spot in `spots`, the `count` closest *approved* candidate spots
 * within `maxKm`. Every input spot gets a key in the result (even unapproved
 * ones — they still get a prerendered page), but only approved candidates
 * with finite coordinates are eligible as neighbours.
 *
 * Ordering is deterministic (km asc, then name.localeCompare) so the build
 * output is stable across runs regardless of DB row order.
 */
export function computeNearbyMap(
  spots: SpotLite[],
  opts: ComputeNearbyOptions = {},
): Record<string, NearbySpot[]> {
  const count = opts.count ?? 5
  const maxKm = opts.maxKm ?? 100
  const photoBySpotId = opts.photoBySpotId ?? {}

  const candidates = spots.filter(
    s =>
      s.approved === true &&
      Number.isFinite(s.latitude) &&
      Number.isFinite(s.longitude),
  )

  const result: Record<string, NearbySpot[]> = {}

  for (const spot of spots) {
    const hasCoords =
      Number.isFinite(spot.latitude) && Number.isFinite(spot.longitude)

    const neighbours: NearbySpot[] = hasCoords
      ? candidates
          .filter(c => c.id !== spot.id)
          .map(c => ({
            spot: c,
            km: haversineKm(spot.latitude, spot.longitude, c.latitude, c.longitude),
          }))
          .filter(({ km }) => km <= maxKm)
          .sort((a, b) => a.km - b.km || a.spot.name.localeCompare(b.spot.name))
          .slice(0, count)
          .map(({ spot: c, km }) => {
            const entry: NearbySpot = {
              id: c.id,
              name: c.name,
              type: c.type,
              km: Math.round(km * 10) / 10,
            }
            const photo = photoBySpotId[c.id]
            if (photo) entry.photo = photo
            return entry
          })
      : []

    result[spot.id] = neighbours
  }

  return result
}
