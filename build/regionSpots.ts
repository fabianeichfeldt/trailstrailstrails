import { haversineKm } from './nearby'
import type { Regions } from './region'

// Build-time region → spot assignment, written to public/regions.json by the
// nitro:config hook and read by the region branch of trails/[slug].vue.

/** One spot listed on a region page, nearest first. */
export interface RegionSpot {
  slug: string
  name: string
  type: 'trail' | 'bikepark' | 'dirtpark'
  approved: boolean
  distanceKm: number
}

/** public/regions.json: region slug → its spots (empty array if none, or for country-level regions). */
export type RegionSpotsMap = Record<string, RegionSpot[]>

/** Spot as fetched for the build (same rows as nearby.json). */
export interface RegionSourceSpot {
  slug?: string | null
  id: string
  name: string
  type: RegionSpot['type']
  approved: boolean
  latitude: number
  longitude: number
}

const MAX_SPOTS = 60

// A radius can't approximate a country border, so zoom <= 8 gets none.
function radiusKm(zoom: number): number {
  if (zoom >= 12) return 20
  if (zoom === 11) return 30
  if (zoom === 10) return 50
  if (zoom === 9) return 70
  return 0
}

export function assignSpotsToRegions(spots: RegionSourceSpot[], regions: Regions): RegionSpotsMap {
  const out: RegionSpotsMap = {}
  for (const [key, region] of Object.entries(regions)) {
    const radius = radiusKm(region.zoom)
    if (!radius) { out[key] = []; continue }
    const hits: (RegionSpot & { km: number })[] = []
    for (const s of spots) {
      if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) continue
      const km = haversineKm(region.lat, region.lng, s.latitude, s.longitude)
      if (km > radius) continue
      hits.push({ slug: s.slug || s.id, name: s.name, type: s.type, approved: s.approved, distanceKm: Math.round(km * 10) / 10, km })
    }
    hits.sort((a, b) => a.km - b.km || a.name.localeCompare(b.name))
    out[key] = hits.slice(0, MAX_SPOTS).map(({ km: _km, ...spot }) => spot)
  }
  return out
}

/** Thin pages (no copy, no spots) are noindexed and kept out of the sitemap. */
export function isRegionIndexable(region: { descr?: string }, spots: RegionSpot[]): boolean {
  return !!region.descr || spots.length > 0
}
