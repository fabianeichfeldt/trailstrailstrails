import { REST, FUNCTIONS, anonHeaders, userHeaders } from './http'
import { BaseTrail, BikePark, DirtPark, isBikePark, isDirtPark, SingleTrail, Trail } from '../types/Trail'
import { TrailDetails } from '../types/TrailDetails'
import type { IAuthService } from '../auth/auth_service'
import { SpotMtbData, MtbTrail, MtbTour, ElevationPoint } from '../types/MtbTypes'

function fallbackDetails(trail: Trail): TrailDetails {
  return new TrailDetails(trail.id)
}

const DETAILS_TTL = 5 * 60 * 1000
const detailsCache = new Map<string, { data: TrailDetails; ts: number }>()

// Maps trail type to the Supabase edge-function path and query-parameter name.
// Adding a new type only requires adding a new entry here — callers stay unchanged.
const DETAIL_ENDPOINT: Record<Trail['type'], { path: string; param: string }> = {
  trail:    { path: 'trail-details',       param: 'trail' },
  bikepark: { path: 'bike-parks-details',  param: 'id' },
  dirtpark: { path: 'dirt-parks-details',  param: 'id' },
}

export async function getTrails(): Promise<SingleTrail[]> {
  const res = await fetch(`${REST}/trails?select=*`, {
    method: 'GET',
    cache: 'no-store',
    headers: anonHeaders(),
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data as Array<Trail>).map(i => ({ ...i, type: 'trail' }))
}

export async function getFavoriteTrails(userID: string): Promise<BaseTrail[]> {
  const res = await fetch(
    `${REST}/trail_favorites?select=*,trails(*)&user_id=eq.${userID}`,
    { method: 'GET', cache: 'no-store', headers: anonHeaders() },
  )
  const data = await res.json()
  return (data as { trails: BaseTrail }[]).map(i => i.trails)
}

export async function getTrailsByUserId(userId: string): Promise<BaseTrail[]> {
  const [dirtRes, trailRes, parkRes] = await Promise.all([
    fetch(`${REST}/dirt_parks?creator_id=eq.${userId}`,   { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
    fetch(`${REST}/trails?select=*&creator_id=eq.${userId}`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
    fetch(`${REST}/parks?creator_id=eq.${userId}`,        { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
  ])

  const [dirtData, trailData, parkData] = await Promise.all([
    dirtRes.json(), trailRes.json(), parkRes.json(),
  ])

  return [
    ...(trailData as SingleTrail[]).map(i => ({ ...i, type: 'trail' as const })),
    ...(dirtData  as DirtPark[])   .map(i => ({ ...i, type: 'dirtpark' as const })),
    ...(parkData  as BikePark[])   .map(i => ({ ...i, type: 'bikepark' as const })),
  ]
}

export interface PhotoResponse {
  url: string
  created_at: string
  trailName: string
  trailID: string
}

export async function getPhotosByUserId(userId: string): Promise<PhotoResponse[]> {
  const res = await fetch(
    `${REST}/trail_photos?select=*,trails(name)&creator=eq.${userId}`,
    { method: 'GET', cache: 'no-store', headers: anonHeaders() },
  )
  const data = await res.json()
  return (data as { url: string; created_at: string; trail_id: string; trails: { name: string } }[])
    .map(i => ({ url: i.url, created_at: i.created_at, trailName: i.trails.name, trailID: i.trail_id }))
}

export async function getLatestPhotos(num = 7): Promise<PhotoResponse[]> {
  const res = await fetch(
    `${REST}/trail_photos?select=*,trails(name)&order=created_at.desc`,
    { method: 'GET', cache: 'no-store', headers: anonHeaders({ 'Range-Unit': 'items', 'Range': `0-${num - 1}` }) },
  )
  const data = await res.json()
  return (data as { url: string; created_at: string; trail_id: string; trails: { name: string } }[])
    .map(i => ({ url: i.url, created_at: i.created_at, trailName: i.trails.name, trailID: i.trail_id }))
}

export async function getTrailDetails(trail: Trail): Promise<TrailDetails> {
  const cached = detailsCache.get(trail.id)
  if (cached && Date.now() - cached.ts < DETAILS_TTL) return cached.data

  const { path, param } = DETAIL_ENDPOINT[trail.type]
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

function toElevationProfile(points: [number, number, number][]): ElevationPoint[] {
  if (points.length === 0) return []
  let cum = 0
  return points.map((p, i) => {
    if (i > 0) {
      const dlat = (p[0] - points[i - 1][0]) * 111000
      const dlng = (p[1] - points[i - 1][1]) * 111000 * Math.cos(p[0] * Math.PI / 180)
      cum += Math.hypot(dlat, dlng) / 1000
    }
    return { dist: Math.round(cum * 10) / 10, alt: p[2] }
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

  const idList = spotIds.map(id => encodeURIComponent(id)).join(',')
  const [tRes, rRes] = await Promise.all([
    fetch(`${REST}/spot_gpx_trails?spot_id=in.(${idList})&select=spot_id,name,difficulty,gpx_points,trail_description`, {
      headers: anonHeaders(),
    }),
    fetch(`${REST}/spot_gpx_tours?spot_id=in.(${idList})&select=spot_id,name,gpx_points`, {
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
  for (const t of rawTrails) result.get(t.spot_id)?.trails.push({ name: t.name, difficulty: t.difficulty, gpx_points: t.gpx_points, trail_description: t.trail_description })
  for (const t of rawTours)  result.get(t.spot_id)?.tours.push({ name: t.name, gpx_points: t.gpx_points })
  return result
}
