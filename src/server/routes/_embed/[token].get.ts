import { resolveHostname, isHostAllowed } from '~/server/utils/embedHostValidation'

export interface EmbedGpxTrail {
  name: string
  difficulty: string
  gpx_points: [number, number, number][]
}

export interface EmbedGpxTour {
  name: string
  gpx_points: [number, number, number][]
}

export interface EmbedTrail {
  id: string
  name: string
  latitude: number
  longitude: number
  type: 'trail' | 'bikepark' | 'dirtpark'
  approved?: boolean
  gpx_trails: EmbedGpxTrail[]
  gpx_tours: EmbedGpxTour[]
}

const TABLE: Record<string, string> = {
  trail:    'trails',
  bikepark: 'parks',
  dirtpark: 'dirt_parks',
}

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')
  const url   = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key   = process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!token || !url || !key) throw createError({ statusCode: 400 })

  const headers = { apikey: key, Authorization: `Bearer ${key}` }

  // Resolve the caller's hostname.
  // Same-origin fetches from the iframe don't send an Origin header, so we
  // accept the parentHost query param forwarded by the embed page (set by embed.js
  // from window.location.hostname on the parent page).
  const originHeader  = getRequestHeader(event, 'origin')
  const refererHeader = getRequestHeader(event, 'referer')
  const parentHost    = (getQuery(event).parentHost as string) || null
  const hostname = resolveHostname(parentHost, originHeader, refererHeader)

  // Fetch the token row
  const tokenRes = await fetch(
    `${url}/rest/v1/embed_tokens?token=eq.${encodeURIComponent(token)}&select=id,allowed_hosts,is_active,is_wildcard&limit=1`,
    { headers },
  )
  if (!tokenRes.ok) throw createError({ statusCode: 502, statusMessage: 'Upstream error' })

  const [tokenRow] = await tokenRes.json() as Array<{
    id: string
    allowed_hosts: string[]
    is_active: boolean
    is_wildcard: boolean
  }>

  if (!tokenRow) throw createError({ statusCode: 403, statusMessage: 'TOKEN_NOT_FOUND' })
  if (!tokenRow.is_active) throw createError({ statusCode: 403, statusMessage: 'TOKEN_INACTIVE' })
  if (!isHostAllowed(hostname, tokenRow.allowed_hosts)) {
    throw createError({ statusCode: 403, statusMessage: 'HOST_NOT_ALLOWED' })
  }

  // Fetch spot data and GPX data.
  // Wildcard tokens fetch everything directly — no IN-list, no URL-length issues.
  // Specific tokens filter by the trail IDs linked in embed_token_trails.
  let spotResults: any[][]
  let gpxTrailsRes: Response
  let gpxToursRes: Response

  if (tokenRow.is_wildcard) {
    const SPOT_FIELDS = 'id,name,latitude,longitude,approved'
    ;[spotResults, [gpxTrailsRes, gpxToursRes]] = await Promise.all([
      Promise.all([
        fetch(`${url}/rest/v1/trails?select=${SPOT_FIELDS}&limit=1000`, { headers })
          .then(r => r.ok ? r.json().then((rows: any[]) => rows.map(x => ({ ...x, type: 'trail' }))) : []),
        fetch(`${url}/rest/v1/parks?select=${SPOT_FIELDS}&limit=1000`, { headers })
          .then(r => r.ok ? r.json().then((rows: any[]) => rows.map(x => ({ ...x, type: 'bikepark' }))) : []),
        fetch(`${url}/rest/v1/dirt_parks?select=${SPOT_FIELDS}&limit=1000`, { headers })
          .then(r => r.ok ? r.json().then((rows: any[]) => rows.map(x => ({ ...x, type: 'dirtpark' }))) : []),
      ]),
      Promise.all([
        fetch(`${url}/rest/v1/spot_gpx_trails?select=spot_id,name,difficulty,gpx_points&limit=5000`, { headers }),
        fetch(`${url}/rest/v1/spot_gpx_tours?select=spot_id,name,gpx_points&limit=5000`, { headers }),
      ]),
    ])
  } else {
    const tokenTrailsRes = await fetch(
      `${url}/rest/v1/embed_token_trails?token_id=eq.${tokenRow.id}&select=trail_id,trail_type`,
      { headers },
    )
    if (!tokenTrailsRes.ok) throw createError({ statusCode: 502, statusMessage: 'Upstream error' })

    const tokenTrails = await tokenTrailsRes.json() as Array<{
      trail_id: string
      trail_type: string
    }>

    if (tokenTrails.length === 0) {
      setResponseHeader(event, 'Access-Control-Allow-Origin', originHeader ?? '*')
      return [] as EmbedTrail[]
    }

    const byType = new Map<string, string[]>()
    for (const { trail_id, trail_type } of tokenTrails) {
      if (!byType.has(trail_type)) byType.set(trail_type, [])
      byType.get(trail_type)!.push(trail_id)
    }
    const idList = tokenTrails.map(t => encodeURIComponent(t.trail_id)).join(',')

    ;[spotResults, [gpxTrailsRes, gpxToursRes]] = await Promise.all([
      Promise.all(
        Array.from(byType.entries()).map(async ([type, ids]) => {
          const table = TABLE[type]
          if (!table || ids.length === 0) return []
          const inClause = ids.map(id => encodeURIComponent(id)).join(',')
          const res = await fetch(
            `${url}/rest/v1/${table}?id=in.(${inClause})&select=id,name,latitude,longitude,approved`,
            { headers },
          )
          if (!res.ok) return []
          const rows = await res.json() as any[]
          return rows.map(r => ({ ...r, type }))
        }),
      ),
      Promise.all([
        fetch(`${url}/rest/v1/spot_gpx_trails?spot_id=in.(${idList})&select=spot_id,name,difficulty,gpx_points&limit=5000`, { headers }),
        fetch(`${url}/rest/v1/spot_gpx_tours?spot_id=in.(${idList})&select=spot_id,name,gpx_points&limit=5000`, { headers }),
      ]),
    ])
  }

  const spots = spotResults.flat() as Array<{ id: string; name: string; latitude: number; longitude: number; type: string; approved?: boolean }>

  const gpxTrails = gpxTrailsRes.ok
    ? (await gpxTrailsRes.json() as Array<{ spot_id: string; name: string; difficulty: string; gpx_points: [number, number, number][] }>)
    : []
  const gpxTours = gpxToursRes.ok
    ? (await gpxToursRes.json() as Array<{ spot_id: string; name: string; gpx_points: [number, number, number][] }>)
    : []

  // Index GPX data by spot_id for O(1) lookup
  const gpxTrailsBySpot = new Map<string, EmbedGpxTrail[]>()
  const gpxToursBySpot  = new Map<string, EmbedGpxTour[]>()
  for (const t of gpxTrails) {
    if (!gpxTrailsBySpot.has(t.spot_id)) gpxTrailsBySpot.set(t.spot_id, [])
    gpxTrailsBySpot.get(t.spot_id)!.push({ name: t.name, difficulty: t.difficulty, gpx_points: t.gpx_points })
  }
  for (const t of gpxTours) {
    if (!gpxToursBySpot.has(t.spot_id)) gpxToursBySpot.set(t.spot_id, [])
    gpxToursBySpot.get(t.spot_id)!.push({ name: t.name, gpx_points: t.gpx_points })
  }

  const results: EmbedTrail[] = spots.map(spot => ({
    id:         spot.id,
    name:       spot.name,
    latitude:   spot.latitude,
    longitude:  spot.longitude,
    type:       spot.type as EmbedTrail['type'],
    approved:   spot.approved,
    gpx_trails: gpxTrailsBySpot.get(spot.id) ?? [],
    gpx_tours:  gpxToursBySpot.get(spot.id)  ?? [],
  }))

  setResponseHeader(event, 'Access-Control-Allow-Origin', originHeader ?? '*')
  return results
})
