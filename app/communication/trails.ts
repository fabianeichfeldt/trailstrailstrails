import { REST, FUNCTIONS, anonHeaders, userHeaders } from './http'
import { Trail } from '../types/Trail'
import { TrailDetails } from '../types/TrailDetails'
import type { IAuthService } from '../auth/auth_service'
import { SpotMtbData, MtbTrail, MtbTour, ElevationPoint } from '../types/MtbTypes'

function fallbackDetails(trail: Trail): TrailDetails {
  return new TrailDetails(trail.id)
}

const DETAILS_TTL = 5 * 60 * 1000
const detailsCache = new Map<string, { data: TrailDetails; ts: number }>()

// The trail_details columns bakedTrailDetails() (app/utils/bakedTrailDetails.ts)
// actually reads to seed the anti-flash/SEO render. Everything else on the row
// (opening_hours_text, affected_trail_ids, rain_window_*, night_* — all
// SpotManager-only) never reaches the detail page, and the genuinely dynamic
// fields are refreshed post-mount by getTrailDetails() anyway. Keep this in
// sync with bakedTrailDetails() — see docs/db-egress-reduction-plan.md P1-1.
const TRAIL_DETAILS_BAKED_COLUMNS =
  'trail_id,rules,last_update,trail_description,status,status_until,status_hint,' +
  'access_type,donation_url,seasonal_from,seasonal_to,rain_policy,rain_closed_hours'

// Maps trail type to the Supabase edge-function path and query-parameter name.
// Adding a new type only requires adding a new entry here — callers stay unchanged.
const DETAIL_ENDPOINT: Record<Trail['type'], { path: string; param: string }> = {
  trail:    { path: 'trail-details',       param: 'trail' },
  bikepark: { path: 'bike-parks-details',  param: 'id' },
  dirtpark: { path: 'dirt-parks-details',  param: 'id' },
}

// Fetches a single spot's full detail payload directly from Supabase REST —
// replaces the former server/api/trail/[id].get.ts. That route only worked
// in production if the nuxt generate prerender crawl happened to bake it
// for this exact id at build time (see "No live Nitro server in production"
// in CLAUDE.md); any trail created/changed after the last deploy 404'd,
// which trails/[slug].vue's onMounted refetch then silently turned into a
// "Nicht gefunden" page. A direct REST call works identically at SSR/build
// time and in the browser afterwards, with no staleness window.
export async function getTrailById(id: string): Promise<Record<string, any> | null> {
  const [trailsRes, parksRes, dirtRes, detailsRes, photosRes] = await Promise.all([
    fetch(`${REST}/trails?id=eq.${id}&select=*`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
    fetch(`${REST}/parks?id=eq.${id}&select=*`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
    fetch(`${REST}/dirt_parks?id=eq.${id}&select=*`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
    fetch(`${REST}/trail_details?trail_id=eq.${id}&select=${TRAIL_DETAILS_BAKED_COLUMNS}`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
    fetch(`${REST}/trail_photos?trail_id=eq.${id}&select=id,url&order=created_at.asc`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
  ])

  const [trails, parks, dirtParks, details, photos] = await Promise.all([
    trailsRes.ok ? trailsRes.json() : [],
    parksRes.ok ? parksRes.json() : [],
    dirtRes.ok ? dirtRes.json() : [],
    detailsRes.ok ? detailsRes.json() : [],
    photosRes.ok ? photosRes.json() : [],
  ])

  // REST filters (?id=eq.<id>) already narrow real Supabase responses to at
  // most one row — the .find() is only load-bearing against test mocks that
  // fulfill these routes with the full unfiltered fixture array.
  let base: Record<string, any> | undefined
  let type: Trail['type'] = 'trail'
  if ((base = (trails as Array<Record<string, any>>).find(t => t.id === id))) {
    type = 'trail'
  } else if ((base = (parks as Array<Record<string, any>>).find(t => t.id === id))) {
    type = 'bikepark'
  } else if ((base = (dirtParks as Array<Record<string, any>>).find(t => t.id === id))) {
    type = 'dirtpark'
  }
  if (!base) return null

  const detail = (details as Array<Record<string, any>>).find(d => d.trail_id === id)
  return { ...base, ...(detail ?? {}), type, photos: Array.isArray(photos) ? photos : [] }
}

// Slug-based counterpart of getTrailById — the primary resolver for
// /trails/[slug] now that spot pages are addressed by name-slug (see
// docs/superpowers/specs/2026-09-01-trail-slug-urls-design.md). Two phases:
// resolve the base spot row + type by slug across the three spot tables, then
// fetch its details + photos by the resolved id (those tables key on the spot
// id, not the slug). Returns null when no spot owns this slug — the caller
// then falls back to getTrailById() to 301 a legacy id URL to its slug.
export async function getTrailBySlug(slug: string): Promise<Record<string, any> | null> {
  const [trailsRes, parksRes, dirtRes] = await Promise.all([
    fetch(`${REST}/trails?slug=eq.${encodeURIComponent(slug)}&select=*`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
    fetch(`${REST}/parks?slug=eq.${encodeURIComponent(slug)}&select=*`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
    fetch(`${REST}/dirt_parks?slug=eq.${encodeURIComponent(slug)}&select=*`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
  ])

  const [trails, parks, dirtParks] = await Promise.all([
    trailsRes.ok ? trailsRes.json() : [],
    parksRes.ok ? parksRes.json() : [],
    dirtRes.ok ? dirtRes.json() : [],
  ])

  let base: Record<string, any> | undefined
  let type: Trail['type'] = 'trail'
  if ((base = (trails as Array<Record<string, any>>).find(t => t.slug === slug))) {
    type = 'trail'
  } else if ((base = (parks as Array<Record<string, any>>).find(t => t.slug === slug))) {
    type = 'bikepark'
  } else if ((base = (dirtParks as Array<Record<string, any>>).find(t => t.slug === slug))) {
    type = 'dirtpark'
  }
  if (!base) return null

  const id = base.id
  const [detailsRes, photosRes] = await Promise.all([
    fetch(`${REST}/trail_details?trail_id=eq.${id}&select=${TRAIL_DETAILS_BAKED_COLUMNS}`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
    fetch(`${REST}/trail_photos?trail_id=eq.${id}&select=id,url&order=created_at.asc`, { method: 'GET', cache: 'no-store', headers: anonHeaders() }),
  ])
  const [details, photos] = await Promise.all([
    detailsRes.ok ? detailsRes.json() : [],
    photosRes.ok ? photosRes.json() : [],
  ])

  const detail = (details as Array<Record<string, any>>).find(d => d.trail_id === id)
  return { ...base, ...(detail ?? {}), type, photos: Array.isArray(photos) ? photos : [] }
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
