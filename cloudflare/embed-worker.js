// Cloudflare Worker source for the `/_embed/*` route.
//
// This worker is NOT deployed by .github/workflows/deploy.yml — there is no
// CI step or wrangler.toml in this repo that pushes it. It must be deployed
// manually (Cloudflare dashboard "Quick edit", or `wrangler deploy` from a
// machine with the right account) whenever this file changes. See
// docs/production-architecture.md.
//
// It is a hand-maintained mirror of server/routes/_embed/[token].get.ts
// (the Nitro route `nuxt dev` runs locally). Whenever that route changes,
// port the change here too and redeploy — the two WILL drift silently
// otherwise, which is exactly what happened when `parking` was added to the
// Nitro route (commit e104ba3) but never ported/redeployed here, causing
// `trail.parking` to be `undefined` in production and crashing the embed
// map with "e.parking is not iterable".

function extractHostname(header) {
  if (!header) return null
  try { return new URL(header).hostname } catch { return null }
}

function isHostAllowed(hostname, allowedHosts) {
  if (!hostname) return false
  return allowedHosts.some(h => h === hostname)
}

function resolveHostname(parentHost, origin, referer) {
  return parentHost ?? extractHostname(origin) ?? extractHostname(referer)
}

const TABLE = { trail: 'trails', bikepark: 'parks', dirtpark: 'dirt_parks' }

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    const url      = new URL(request.url)
    const token    = url.pathname.replace(/^\/_embed\//, '')
    const parentHost = url.searchParams.get('parentHost')
    const origin   = request.headers.get('origin')
    const referer  = request.headers.get('referer')
    const hostname = resolveHostname(parentHost, origin, referer)

    const SB   = 'https://ixafegmxkadbzhxmepsd.supabase.co'
    const key  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4YWZlZ214a2FkYnpoeG1lcHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2Mjc1MzAsImV4cCI6MjA3NjIwMzUzMH0.BRbdccgrW7aZpvB_S4_qKn_BRcfPMyWjQAVuVuy2wyQ'
    const h    = { apikey: key, Authorization: `Bearer ${key}` }

    const error = (status, msg) => Response.json(
      { statusMessage: msg },
      { status, headers: { 'Access-Control-Allow-Origin': origin ?? '*' } },
    )

    if (!token) return error(400, 'BAD_REQUEST')

    // Fetch token row
    const tokenRes = await fetch(
      `${SB}/rest/v1/embed_tokens?token=eq.${encodeURIComponent(token)}&select=id,allowed_hosts,is_active,is_wildcard&limit=1`,
      { headers: h },
    )
    if (!tokenRes.ok) return error(502, 'UPSTREAM_ERROR')

    const [tokenRow] = await tokenRes.json()
    if (!tokenRow)          return error(403, 'TOKEN_NOT_FOUND')
    if (!tokenRow.is_active) return error(403, 'TOKEN_INACTIVE')
    if (!isHostAllowed(hostname, tokenRow.allowed_hosts)) return error(403, 'HOST_NOT_ALLOWED')

    const SPOT_FIELDS = 'id,name,latitude,longitude,approved'
    let spots, gpxTrailsRes, gpxToursRes, parkingRes

    if (tokenRow.is_wildcard) {
      const [trails, parks, dirtParks, gT, gTour, park] = await Promise.all([
        fetch(`${SB}/rest/v1/trails?select=${SPOT_FIELDS}&limit=1000`, { headers: h }).then(r => r.ok ? r.json() : []).then(rows => rows.map(x => ({ ...x, type: 'trail' }))),
        fetch(`${SB}/rest/v1/parks?select=${SPOT_FIELDS}&limit=1000`, { headers: h }).then(r => r.ok ? r.json() : []).then(rows => rows.map(x => ({ ...x, type: 'bikepark' }))),
        fetch(`${SB}/rest/v1/dirt_parks?select=${SPOT_FIELDS}&limit=1000`, { headers: h }).then(r => r.ok ? r.json() : []).then(rows => rows.map(x => ({ ...x, type: 'dirtpark' }))),
        fetch(`${SB}/rest/v1/spot_gpx_trails?select=spot_id,name,difficulty,gpx_points&limit=5000`, { headers: h }),
        fetch(`${SB}/rest/v1/spot_gpx_tours?select=spot_id,name,gpx_points&limit=5000`, { headers: h }),
        fetch(`${SB}/rest/v1/parking?select=id,spot_id,name,lat,lng&limit=2000`, { headers: h }),
      ])
      spots = [...trails, ...parks, ...dirtParks]
      gpxTrailsRes = gT
      gpxToursRes  = gTour
      parkingRes   = park
    } else {
      const tokenTrailsRes = await fetch(
        `${SB}/rest/v1/embed_token_trails?token_id=eq.${tokenRow.id}&select=trail_id,trail_type`,
        { headers: h },
      )
      if (!tokenTrailsRes.ok) return error(502, 'UPSTREAM_ERROR')

      const tokenTrails = await tokenTrailsRes.json()
      if (tokenTrails.length === 0) {
        return Response.json([], { headers: { 'Access-Control-Allow-Origin': origin ?? '*' } })
      }

      const byType = new Map()
      for (const { trail_id, trail_type } of tokenTrails) {
        if (!byType.has(trail_type)) byType.set(trail_type, [])
        byType.get(trail_type).push(trail_id)
      }
      const idList = tokenTrails.map(t => encodeURIComponent(t.trail_id)).join(',')

      const spotFetches = Array.from(byType.entries()).map(async ([type, ids]) => {
        const table = TABLE[type]
        if (!table) return []
        const inClause = ids.map(id => encodeURIComponent(id)).join(',')
        const res = await fetch(`${SB}/rest/v1/${table}?id=in.(${inClause})&select=${SPOT_FIELDS}`, { headers: h })
        if (!res.ok) return []
        const rows = await res.json()
        return rows.map(r => ({ ...r, type }))
      })

      const [spotArrays, gT, gTour, park] = await Promise.all([
        Promise.all(spotFetches),
        fetch(`${SB}/rest/v1/spot_gpx_trails?spot_id=in.(${idList})&select=spot_id,name,difficulty,gpx_points&limit=5000`, { headers: h }),
        fetch(`${SB}/rest/v1/spot_gpx_tours?spot_id=in.(${idList})&select=spot_id,name,gpx_points&limit=5000`, { headers: h }),
        fetch(`${SB}/rest/v1/parking?spot_id=in.(${idList})&select=id,spot_id,name,lat,lng&limit=2000`, { headers: h }),
      ])
      spots = spotArrays.flat()
      gpxTrailsRes = gT
      gpxToursRes  = gTour
      parkingRes   = park
    }

    const gpxTrails   = gpxTrailsRes.ok ? await gpxTrailsRes.json() : []
    const gpxTours    = gpxToursRes.ok  ? await gpxToursRes.json()  : []
    const parkingRows = parkingRes.ok   ? await parkingRes.json()   : []

    const gpxTrailsBySpot = new Map()
    const gpxToursBySpot  = new Map()
    const parkingBySpot   = new Map()
    for (const t of gpxTrails) {
      if (!gpxTrailsBySpot.has(t.spot_id)) gpxTrailsBySpot.set(t.spot_id, [])
      gpxTrailsBySpot.get(t.spot_id).push({ name: t.name, difficulty: t.difficulty, gpx_points: t.gpx_points })
    }
    for (const t of gpxTours) {
      if (!gpxToursBySpot.has(t.spot_id)) gpxToursBySpot.set(t.spot_id, [])
      gpxToursBySpot.get(t.spot_id).push({ name: t.name, gpx_points: t.gpx_points })
    }
    for (const p of parkingRows) {
      if (!parkingBySpot.has(p.spot_id)) parkingBySpot.set(p.spot_id, [])
      parkingBySpot.get(p.spot_id).push({ id: p.id, name: p.name, lat: p.lat, lng: p.lng })
    }

    const results = spots.map(spot => ({
      id:         spot.id,
      name:       spot.name,
      latitude:   spot.latitude,
      longitude:  spot.longitude,
      type:       spot.type,
      approved:   spot.approved,
      gpx_trails: gpxTrailsBySpot.get(spot.id) ?? [],
      gpx_tours:  gpxToursBySpot.get(spot.id)  ?? [],
      parking:    parkingBySpot.get(spot.id)   ?? [],
    }))

    return Response.json(results, {
      headers: { 'Access-Control-Allow-Origin': origin ?? '*' },
    })
  },
}
