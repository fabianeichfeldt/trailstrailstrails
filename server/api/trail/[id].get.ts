export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!id || !url || !key) throw createError({ statusCode: 400 })

  const headers = { apikey: key, Authorization: `Bearer ${key}` }

  // Search all three tables in parallel, plus trail_details
  const [trailsRes, parksRes, dirtRes, detailRes] = await Promise.all([
    fetch(`${url}/rest/v1/trails?id=eq.${id}&select=*`, { headers }),
    fetch(`${url}/rest/v1/parks?id=eq.${id}&select=*`, { headers }),
    fetch(`${url}/rest/v1/dirt_parks?id=eq.${id}&select=*`, { headers }),
    fetch(`${url}/rest/v1/trail_details?trail_id=eq.${id}&select=*`, { headers }),
  ])

  const [trails, parks, dirtParks, details] = await Promise.all([
    trailsRes.json(),
    parksRes.json(),
    dirtRes.json(),
    detailRes.json(),
  ])

  let base: any = null
  let type = 'trail'

  if (trails[0]) { base = trails[0]; type = 'trail' }
  else if (parks[0]) { base = parks[0]; type = 'bikepark' }
  else if (dirtParks[0]) { base = dirtParks[0]; type = 'dirtpark' }

  if (!base) throw createError({ statusCode: 404, statusMessage: 'Trail not found' })

  return { ...base, ...((details[0]) ?? {}), type }
})
