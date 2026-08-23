import { REST, anonHeaders } from './http'

export type ActivityType = 'spot' | 'photo' | 'gpx'

export interface ActivityItem {
  type: ActivityType
  trailId: string
  name: string
  created_at: string
}

const LIST_LIMIT = 30
const RESULT_LIMIT = 8

interface SpotRow { id: string; name: string; created_at: string }
interface LinkedTrail { id: string; name: string; approved: boolean }
interface LinkedRow { id: string; created_at: string; trails: LinkedTrail | null }

async function fetchList<T>(query: string): Promise<T[]> {
  const res = await fetch(`${REST}/${query}`, { method: 'GET', cache: 'no-store', headers: anonHeaders() })
  if (!res.ok) return []
  return res.json()
}

/** Builds the "recent activity" feed from spot/photo/GPX timestamps — there is no dedicated activity table. */
export async function getRecentActivity(): Promise<ActivityItem[]> {
  const [trails, parks, dirtParks, photos, gpxTrails, gpxTours] = await Promise.all([
    fetchList<SpotRow>(`trails?select=id,name,created_at&approved=eq.true&order=created_at.desc&limit=${LIST_LIMIT}`),
    fetchList<SpotRow>(`parks?select=id,name,created_at&approved=eq.true&order=created_at.desc&limit=${LIST_LIMIT}`),
    fetchList<SpotRow>(`dirt_parks?select=id,name,created_at&approved=eq.true&order=created_at.desc&limit=${LIST_LIMIT}`),
    fetchList<LinkedRow>(`trail_photos?select=id,created_at,trails(id,name,approved)&order=created_at.desc&limit=${LIST_LIMIT}`),
    fetchList<LinkedRow>(`spot_gpx_trails?select=id,created_at,trails(id,name,approved)&order=created_at.desc&limit=${LIST_LIMIT}`),
    fetchList<LinkedRow>(`spot_gpx_tours?select=id,created_at,trails(id,name,approved)&order=created_at.desc&limit=${LIST_LIMIT}`),
  ])

  const items: ActivityItem[] = []

  for (const t of trails) items.push({ type: 'spot', trailId: t.id, name: t.name, created_at: t.created_at })
  for (const p of parks) items.push({ type: 'spot', trailId: p.id, name: p.name, created_at: p.created_at })
  for (const d of dirtParks) items.push({ type: 'spot', trailId: d.id, name: d.name, created_at: d.created_at })

  for (const p of photos) {
    if (!p.trails?.approved) continue
    items.push({ type: 'photo', trailId: p.trails.id, name: p.trails.name, created_at: p.created_at })
  }

  for (const g of [...gpxTrails, ...gpxTours]) {
    if (!g.trails?.approved) continue
    items.push({ type: 'gpx', trailId: g.trails.id, name: g.trails.name, created_at: g.created_at })
  }

  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const deduped: ActivityItem[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const key = `${item.type}:${item.trailId}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
    if (deduped.length >= RESULT_LIMIT) break
  }

  return deduped
}
