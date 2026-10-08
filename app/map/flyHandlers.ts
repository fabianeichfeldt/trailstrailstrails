import { REGION_ZOOM, SPOT_ZOOM } from './zoomLevels'

const FLY_DURATION_S = 1.2
const MIN_ZOOM = 3
const MAX_ZOOM = 19

/** The slice of a Leaflet map the fly-to handlers need. */
export interface FlyableMap {
  flyTo(center: [number, number], zoom: number, options?: { duration: number }): unknown
}

/** Handlers behind the search bar and the `?trail=` / `?fly=` deep links; the spot lookup is injected. */
export function createMapFlyers(
  map: FlyableMap,
  findSpot: (id: string) => { latitude: number; longitude: number } | undefined,
) {
  return {
    openTrail(id: string) {
      const spot = findSpot(id)
      if (!spot) return
      map.flyTo([spot.latitude, spot.longitude], SPOT_ZOOM, { duration: FLY_DURATION_S })
    },
    flyToPlace(lat: number, lon: number, zoom: number = REGION_ZOOM) {
      map.flyTo([lat, lon], zoom, { duration: FLY_DURATION_S })
    },
  }
}

/** Parses `?fly=lat,lng&zoom=n`; a missing or out-of-range zoom comes back undefined. */
export function parseFlyQuery(fly: unknown, zoom: unknown): { lat: number; lng: number; zoom?: number } | null {
  if (typeof fly !== 'string') return null
  const [latStr, lngStr] = fly.split(',')
  const lat = parseFloat(latStr)
  const lng = parseFloat(lngStr)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  const z = typeof zoom === 'string' ? parseInt(zoom, 10) : NaN
  return { lat, lng, zoom: z >= MIN_ZOOM && z <= MAX_ZOOM ? z : undefined }
}
