// No http.ts import: nuxt.config.ts loads this at config time, where import.meta.env is unset.
import { SPOT_TYPE_LIST, visibleFilter, type SpotType, type SpotTypeDef } from '../types/SpotTypes'
import type { Trail } from '../types/Trail'

export type SpotPhoto = { id: string; url: string; copyright?: string | null }

// A resolved spot page payload: the base row + its details row + photos.
export type ResolvedSpot = Trail & { photos: SpotPhoto[] } & Record<string, any>

export const PHOTO_COLUMNS = 'id,url,copyright'

// Build-only (outside public/ so it never ships); written by nuxt.config.ts, read during prerender.
export const SPOT_SNAPSHOT_PATH = 'node_modules/.cache/trailradar/spots.json'

const PAGE_SIZE = 1000 // PostgREST's default max-rows

export function detailsSelect(def: SpotTypeDef): string {
  const columns = def.detailsColumns
  return columns.split(',').includes(def.detailsIdColumn) ? columns : `${def.detailsIdColumn},${columns}`
}

// The one place a spot page payload is assembled — live resolveSpot() and the build snapshot both use it.
export function mergeSpot(base: Record<string, any>, detail: Record<string, any> | undefined, type: SpotType, photos: SpotPhoto[]): ResolvedSpot {
  return { ...base, ...(detail ?? {}), type, photos } as ResolvedSpot
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

// Reads every row of a PostgREST query, PAGE_SIZE rows per request. `query` needs a stable order.
async function fetchAllRows<T>(rest: string, headers: Record<string, string>, query: string, fetchImpl: Fetch): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await fetchImpl(`${rest}/${query}&limit=${PAGE_SIZE}&offset=${offset}`, { headers })
    if (!res.ok) throw new Error(`${query}: ${res.status}`)
    const page = await res.json() as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

// Every visible spot with its details row and photos, in a constant number of paged requests
// (instead of ~4 per spot page during prerender). Throws on any failed page.
export async function fetchAllSpots(rest: string, headers: Record<string, string>, fetchImpl: Fetch = fetch): Promise<ResolvedSpot[]> {
  const [photoRows, ...perType] = await Promise.all([
    fetchAllRows<SpotPhoto & { trail_id: string }>(rest, headers,
      `trail_photos?select=trail_id,${PHOTO_COLUMNS}&order=created_at.asc,id.asc`, fetchImpl),
    ...SPOT_TYPE_LIST.map(async def => {
      const [bases, details] = await Promise.all([
        fetchAllRows<Record<string, any>>(rest, headers, `${def.table}?select=*${visibleFilter(def)}&order=id.asc`, fetchImpl),
        fetchAllRows<Record<string, any>>(rest, headers, `${def.detailsTable}?select=${detailsSelect(def)}&order=${def.detailsIdColumn}.asc`, fetchImpl),
      ])
      return { def, bases, details }
    }),
  ])

  const photosBySpot = new Map<string, SpotPhoto[]>()
  for (const { trail_id, ...photo } of photoRows) {
    const list = photosBySpot.get(trail_id) ?? []
    list.push(photo)
    photosBySpot.set(trail_id, list)
  }

  return perType.flatMap(({ def, bases, details }) => {
    const detailById = new Map(details.map(d => [String(d[def.detailsIdColumn]), d]))
    return bases.map(base => mergeSpot(base, detailById.get(String(base.id)), def.type, photosBySpot.get(String(base.id)) ?? []))
  })
}

// Keyed the way prerender routes are built: /trails/<slug || id>.
export function buildSpotSnapshot(spots: ResolvedSpot[]): Record<string, ResolvedSpot> {
  return Object.fromEntries(spots.map(s => [String(s.slug || s.id), s]))
}
