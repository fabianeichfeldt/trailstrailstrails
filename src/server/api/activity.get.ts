export default defineEventHandler(async () => {
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return []

  const h = { apikey: key, Authorization: `Bearer ${key}` }
  const q = (path: string) => fetch(`${url}/rest/v1/${path}`, { headers: h }).then(r => r.ok ? r.json() : [])

  const [trails, parks, dirts, photos, gpxTrails, gpxTours] = await Promise.all([
    q('trails?select=id,name,created_at&approved=eq.true&order=created_at.desc&limit=30'),
    q('parks?select=id,name,created_at&approved=eq.true&order=created_at.desc&limit=30'),
    q('dirt_parks?select=id,name,created_at&approved=eq.true&order=created_at.desc&limit=30'),
    q('trail_photos?select=id,created_at,trails(id,name,approved)&order=created_at.desc&limit=30'),
    q('spot_gpx_trails?select=id,created_at,spot_id,trails(id,name,approved)&order=created_at.desc&limit=30'),
    q('spot_gpx_tours?select=id,created_at,spot_id,trails(id,name,approved)&order=created_at.desc&limit=30'),
  ])

  type Item = { type: 'spot' | 'photo' | 'gpx'; trailId: string; name: string; created_at: string }
  const items: Item[] = []

  for (const t of (trails as any[])) items.push({ type: 'spot', trailId: t.id, name: t.name, created_at: t.created_at })
  for (const p of (parks as any[])) items.push({ type: 'spot', trailId: p.id, name: p.name, created_at: p.created_at })
  for (const d of (dirts as any[])) items.push({ type: 'spot', trailId: d.id, name: d.name, created_at: d.created_at })

  for (const p of (photos as any[])) {
    const trail = p.trails
    if (!trail?.approved) continue
    items.push({ type: 'photo', trailId: trail.id, name: trail.name, created_at: p.created_at })
  }

  for (const g of [...(gpxTrails as any[]), ...(gpxTours as any[])]) {
    const trail = g.trails
    if (!trail?.approved) continue
    items.push({ type: 'gpx', trailId: trail.id, name: trail.name, created_at: g.created_at })
  }

  // Sort by date desc, dedupe adjacent same trail+type, return top 8
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const deduped: Item[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const key = `${item.type}:${item.trailId}`
    if (!seen.has(key)) { seen.add(key); deduped.push(item) }
    if (deduped.length >= 8) break
  }

  return deduped
})
