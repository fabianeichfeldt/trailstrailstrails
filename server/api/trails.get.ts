export default defineEventHandler(async () => {
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) return []

  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  const fields = 'id,name,latitude,longitude,approved'

  const [trailsRes, parksRes, dirtRes] = await Promise.all([
    fetch(`${url}/rest/v1/trails?select=${fields}`, { headers }),
    fetch(`${url}/rest/v1/parks?select=${fields}`, { headers }),
    fetch(`${url}/rest/v1/dirt_parks?select=${fields}`, { headers }),
  ])

  if (!trailsRes.ok || !parksRes.ok || !dirtRes.ok) return []

  const [trails, parks, dirtParks] = await Promise.all([
    trailsRes.json(),
    parksRes.json(),
    dirtRes.json(),
  ])

  return [
    ...(trails as any[]).map(t => ({ ...t, type: 'trail' })),
    ...(parks as any[]).map(p => ({ ...p, type: 'bikepark' })),
    ...(dirtParks as any[]).map(d => ({ ...d, type: 'dirtpark' })),
  ]
})
