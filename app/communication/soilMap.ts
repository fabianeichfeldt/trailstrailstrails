import type { SoilMapResponse } from '~/types/SoilMap'
import { FUNCTIONS, userHeaders } from './http'

/**
 * Boden-Radar snapshot from the `soil-map` edge function (the gate: JWT +
 * `has_min_tier`). The caller passes the access token; communication/ must not
 * reach into stores.
 */

// v2: entries carry their fetch time and follow the backend's nextRunAt.
const CACHE_KEY = 'tr_soil_v2'
// The backend job needs a moment after each slot before the new snapshot is readable.
const GRACE_MS = 10 * 60 * 1000
// Only for responses without `nextRunAt` (a backend from before that field).
const FALLBACK_TTL_MS = 60 * 60 * 1000

interface CacheEntry {
  /** Fetch time (ms). */
  at: number
  data: SoilMapResponse
}

function isSoilMap(value: unknown): value is SoilMapResponse {
  const v = value as SoilMapResponse | null
  return !!v && typeof v.computedAt === 'string' && !Number.isNaN(Date.parse(v.computedAt)) && Array.isArray(v.spots)
}

// No localStorage during prerender; it also throws in some private modes.
function readCache(): CacheEntry | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (typeof entry?.at !== 'number' || !isSoilMap(entry.data)) throw new Error('corrupt cache entry')
    return entry
  } catch {
    clearCache()
    return null
  }
}

function writeCache(data: SoilMapResponse): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data } satisfies CacheEntry))
  } catch { /* quota or private mode — the fetch still succeeded */ }
}

function clearCache(): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(CACHE_KEY) } catch { /* nothing sensible left to do */ }
}

// The backend owns the schedule: cache until its next run (plus time for the job to finish).
function isFresh(entry: CacheEntry, now: number): boolean {
  const nextRun = Date.parse(entry.data.nextRunAt ?? '')
  if (!Number.isNaN(nextRun)) return now <= nextRun + GRACE_MS
  return now <= entry.at + FALLBACK_TTL_MS
}

/**
 * Never throws. `offline: true` marks a stale snapshot served because the
 * network failed. A 403 drops the cache (a downgraded user keeps nothing) and
 * fires `onForbidden`.
 */
export async function fetchSoilMap(
  accessToken: string,
  onForbidden?: () => void,
): Promise<{ data: SoilMapResponse; offline: boolean } | null> {
  const cached = readCache()
  if (cached && isFresh(cached, Date.now())) return { data: cached.data, offline: false }

  const stale = cached ? { data: cached.data, offline: true } : null
  try {
    const res = await fetch(`${FUNCTIONS}/soil-map`, { method: 'POST', headers: userHeaders(accessToken) })
    if (res.status === 403) {
      clearCache()
      onForbidden?.()
      return null
    }
    if (!res.ok) return stale
    const body: unknown = await res.json()
    if (!isSoilMap(body)) return stale
    writeCache(body)
    return { data: body, offline: false }
  } catch {
    return stale
  }
}
