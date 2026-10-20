import { REST, FUNCTIONS, anonHeaders, userHeaders } from './http'
import { Trail } from '../types/Trail'
import { SPOT_TYPES, SPOT_TYPE_LIST, visibleFilter, type SpotType } from '../types/SpotTypes'
import { TrailDetails } from '../types/TrailDetails'
import type { IAuthService } from '../auth/auth_service'
import { SpotMtbData, MtbTrail, MtbTour, ElevationPoint } from '../types/MtbTypes'

function fallbackDetails(trail: Trail): TrailDetails {
  return new TrailDetails(trail.id)
}

const DETAILS_TTL = 5 * 60 * 1000
const detailsCache = new Map<string, { data: TrailDetails; ts: number }>()

// Fetches the type-specific details row + photos for a resolved spot.
// A failed fetch degrades to empty details/photos.
async function fetchSpotExtras(id: string, type: SpotType): Promise<{ detail: Record<string, any> | undefined; photos: unknown[] }> {
  const { detailsTable: table, detailsIdColumn: idColumn, detailsColumns: columns } = SPOT_TYPES[type]
  const select = columns.split(',').includes(idColumn) ? columns : `${idColumn},${columns}`
  const [detailsRes, photosRes] = await Promise.all([
    fetch(`${REST}/${table}?${idColumn}=eq.${id}&select=${select}`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
    fetch(`${REST}/trail_photos?trail_id=eq.${id}&select=id,url,copyright&order=created_at.asc`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
  ])
  const [details, photos] = await Promise.all([
    detailsRes.ok ? detailsRes.json() : [],
    photosRes.ok ? photosRes.json() : [],
  ])
  return {
    detail: (details as Array<Record<string, any>>).find(d => d[idColumn] === id),
    photos: Array.isArray(photos) ? photos : [],
  }
}

// A resolved spot page payload: the base row + its details row + photos.
export type ResolvedSpot = Trail & { photos: Array<{ id: string; url: string; copyright?: string | null }> } & Record<string, any>

// Resolves one spot by id or slug straight from Supabase REST (replaces the
// former server/api/trail/[id].get.ts, which 404'd for anything created since
// the last build — see "No live Nitro server in production" in CLAUDE.md).
// Probes every registry base table in parallel; details + photos are fetched
// only after the type is known, since they key on the spot id.
export async function resolveSpot(field: 'id' | 'slug', value: string): Promise<ResolvedSpot | null> {
  const results = await Promise.all(SPOT_TYPE_LIST.map(async def => {
    const res = await fetch(
      `${REST}/${def.table}?${field}=eq.${encodeURIComponent(value)}${visibleFilter(def)}&select=*`,
      { method: 'GET', cache: 'no-store', headers: anonHeaders() },
    )
    return res.ok ? await res.json() as Array<Record<string, any>> : []
  }))

  // REST filters already narrow real responses to one row — the .find() is
  // load-bearing against e2e mocks that ignore eq filters (tests/fixtures.ts).
  const hit = SPOT_TYPE_LIST
    .map((def, i) => ({ type: def.type, base: results[i]?.find(r => r[field] === value) }))
    .find(h => h.base)
  if (!hit?.base) return null
  const { base, type } = hit

  const { detail, photos } = await fetchSpotExtras(base.id, type)
  return { ...base, ...(detail ?? {}), type, photos } as ResolvedSpot
}

export const getTrailById = (id: string) => resolveSpot('id', id)
// Primary resolver for /trails/[slug]; null falls the caller back to getTrailById (legacy id URLs).
export const getTrailBySlug = (slug: string) => resolveSpot('slug', slug)

export async function getTrailDetails(trail: Trail): Promise<TrailDetails> {
  const cached = detailsCache.get(trail.id)
  if (cached && Date.now() - cached.ts < DETAILS_TTL) return cached.data

  const { path, param } = SPOT_TYPES[trail.type].detailsEndpoint
  const res = await fetch(`${FUNCTIONS}/${path}?${param}=${trail.id}`, {
    method: 'GET',
    cache: 'no-store',
    headers: anonHeaders(),
  })

  if (!res.ok) return fallbackDetails(trail)

  const json = await res.json()
  const data = json.data ?? fallbackDetails(trail)
  detailsCache.set(trail.id, { data, ts: Date.now() })
  return data
}

export async function likeTrail(trailID: string, authService: IAuthService) {
  const user = await authService.getUser()
  await fetch(`${REST}/trail_favorites`, {
    method: 'POST',
    cache: 'no-store',
    headers: userHeaders(user.accessToken),
    body: JSON.stringify({ user_id: user.id, trail_id: trailID }),
  })
}

export async function dislikeTrail(trailID: string, authService: IAuthService) {
  const user = await authService.getUser()
  await fetch(`${REST}/trail_favorites?trail_id=eq.${trailID}&user_id=eq.${user.id}`, {
    method: 'DELETE',
    cache: 'no-store',
    headers: userHeaders(user.accessToken, { Prefer: 'return=representation' }),
  })
}

// ── GPX Data ──────────────────────────────────────────────────────────────────

export function toElevationProfile(points: [number, number, number][]): ElevationPoint[] {
  if (points.length === 0) return []
  let cum = 0
  return points.map((p, i) => {
    if (i > 0) {
      const dlat = (p[0] - points[i - 1][0]) * 111000
      const dlng = (p[1] - points[i - 1][1]) * 111000 * Math.cos(p[0] * Math.PI / 180)
      cum += Math.hypot(dlat, dlng) / 1000
    }
    return { dist: cum, alt: p[2] }
  })
}

interface RawGpxTrail {
  id: string
  spot_id: string
  name: string
  difficulty: string
  direction: string
  distance_km: number
  elevation_gain: number
  elevation_loss: number
  gpx_points: [number, number, number][]
  gpx_url?: string
  // Trail status visualization — see app/types/TrailStatus.ts.
  closed_from?: string | null
  closed_to?: string | null
  hint?: string | null
}

interface RawGpxTour {
  id: string
  spot_id: string
  name: string
  direction: 'cw' | 'ccw'
  duration_minutes: number
  trail_names?: string[] | null
  distance_km: number
  elevation_gain: number
  elevation_loss: number
  gpx_points: [number, number, number][]
  gpx_url?: string
}

export async function getSpotGpxData(spotId: string): Promise<SpotMtbData | null> {
  try {
    const [trailsRes, toursRes] = await Promise.all([
      fetch(`${REST}/spot_gpx_trails?select=*&spot_id=eq.${spotId}`, {
        method: 'GET', cache: 'no-store', headers: anonHeaders(),
      }),
      fetch(`${REST}/spot_gpx_tours?select=*&spot_id=eq.${spotId}`, {
        method: 'GET', cache: 'no-store', headers: anonHeaders(),
      }),
    ])

    if (!trailsRes.ok || !toursRes.ok) return null

    const rawTrails = (await trailsRes.json()) as RawGpxTrail[]
    const rawTours  = (await toursRes.json()) as RawGpxTour[]

    const trails: MtbTrail[] = rawTrails.map((rt, i) => ({
      id:              rt.id || `${spotId}-trail-${i}`,
      spotId:          rt.spot_id,
      name:            rt.name,
      difficulty:      rt.difficulty as any,
      direction:       rt.direction as any,
      distance_km:     rt.distance_km,
      elevation_gain:  rt.elevation_gain,
      elevation_loss:  rt.elevation_loss,
      gpxPoints:       rt.gpx_points,
      elevationProfile: toElevationProfile(rt.gpx_points),
      gpx_url:         rt.gpx_url,
      closed_from:     rt.closed_from,
      closed_to:       rt.closed_to,
      hint:            rt.hint,
    }))

    const tours: MtbTour[] = rawTours.map((rt, i) => ({
      id:              rt.id || `${spotId}-tour-${i}`,
      spotId:          rt.spot_id,
      name:            rt.name,
      direction:       rt.direction,
      duration_minutes: rt.duration_minutes,
      distance_km:     rt.distance_km,
      elevation_gain:  rt.elevation_gain,
      elevation_loss:  rt.elevation_loss,
      trailCount:      rt.trail_names?.length ?? 0,
      segments:        [],
      gpxPoints:       rt.gpx_points,
      elevationProfile: toElevationProfile(rt.gpx_points),
      hasFullGpx:      true,
      gpx_url:         rt.gpx_url,
    }))

    const trailsByName = new Map(trails.map(t => [t.name, t]))
    for (let i = 0; i < tours.length; i++) {
      const tour    = tours[i]
      const rawTour = rawTours[i]
      if (!tour.gpxPoints?.length) continue

      if (rawTour.trail_names?.length) {
        tour.segments = rawTour.trail_names
          .map(name => trailsByName.get(name))
          .filter(Boolean)
          .map(trail => ({
            type:       'trail' as const,
            trailId:    trail!.id,
            difficulty: trail!.difficulty,
            name:       trail!.name,
            gpxPoints:  trail!.gpxPoints,
          }))
      }
    }

    return { spotId, trails, tours }
  } catch (err) {
    console.error('Error fetching spot GPX data:', err)
    return null
  }
}

// ── Lightweight GPX fetch for the elevation tooltip ───────────────────────────

export interface SpotGpxTrail {
  name: string
  difficulty: string
  gpx_points: [number, number, number][]
  trail_description?: string
  // Trail status visualization — see app/types/TrailStatus.ts. Fed straight
  // into deriveTrailStatus() by the map's GPX badge rendering.
  closed_from?: string | null
  closed_to?: string | null
  hint?: string | null
}

export interface SpotGpxTour {
  name: string
  gpx_points: [number, number, number][]
}

/** Batch-fetch GPX for many spots in two round trips (used by the main map GPX view). */
export async function fetchMultipleSpotGpx(
  spotIds: string[],
): Promise<Map<string, { trails: SpotGpxTrail[]; tours: SpotGpxTour[] }>> {
  if (!spotIds.length) return new Map()

  // Scope both requests to the requested spots. Without this filter PostgREST
  // returns gpx_points (the largest column in the schema) for *every* row in
  // spot_gpx_trails / spot_gpx_tours on every GPX-view render — see
  // docs/db-egress-reduction-plan.md P0-1.
  const idList = spotIds.map(id => encodeURIComponent(id)).join(',')
  const [tRes, rRes] = await Promise.all([
    fetch(`${REST}/spot_gpx_trails?select=spot_id,name,difficulty,gpx_points,trail_description,closed_from,closed_to,hint&spot_id=in.(${idList})`, {
      headers: anonHeaders(),
    }),
    fetch(`${REST}/spot_gpx_tours?select=spot_id,name,gpx_points&spot_id=in.(${idList})`, {
      headers: anonHeaders(),
    }),
  ])

  type RawT = SpotGpxTrail & { spot_id: string }
  type RawR = SpotGpxTour  & { spot_id: string }

  if (!tRes.ok) throw new Error(`spot_gpx_trails fetch failed: ${tRes.status}`)
  if (!rRes.ok) throw new Error(`spot_gpx_tours fetch failed: ${rRes.status}`)

  const rawTrails: RawT[] = await tRes.json()
  const rawTours:  RawR[] = await rRes.json()

  const result = new Map<string, { trails: SpotGpxTrail[]; tours: SpotGpxTour[] }>()
  for (const id of spotIds) result.set(id, { trails: [], tours: [] })
  for (const t of rawTrails) result.get(t.spot_id)?.trails.push({
    name: t.name,
    difficulty: t.difficulty,
    gpx_points: t.gpx_points,
    trail_description: t.trail_description,
    closed_from: t.closed_from,
    closed_to: t.closed_to,
    hint: t.hint,
  })
  for (const t of rawTours)  result.get(t.spot_id)?.tours.push({ name: t.name, gpx_points: t.gpx_points })
  return result
}

// ── Parking lots ──────────────────────────────────────────────────────────────

export interface SpotParkingLot {
  id: string
  name: string
  lat: number
  lng: number
  info?: string[]
}

/** Batch-fetch parking lots for many spots in one round trip (used by the main map). */
export async function fetchMultipleSpotParking(
  spotIds: string[],
): Promise<Map<string, SpotParkingLot[]>> {
  if (!spotIds.length) return new Map()

  const idList = spotIds.map(id => encodeURIComponent(id)).join(',')
  const res = await fetch(
    `${REST}/parking?select=id,spot_id,name,lat,lng,info&spot_id=in.(${idList})`,
    { headers: anonHeaders() },
  )
  if (!res.ok) throw new Error(`parking fetch failed: ${res.status}`)

  type RawParking = SpotParkingLot & { spot_id: string }
  const raw: RawParking[] = await res.json()

  const result = new Map<string, SpotParkingLot[]>()
  for (const id of spotIds) result.set(id, [])
  for (const p of raw) {
    result.get(p.spot_id)?.push({
      id: p.id, name: p.name, lat: p.lat, lng: p.lng, info: p.info ?? [],
    })
  }
  return result
}
