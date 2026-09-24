import type { TrailConditionResponse } from '~/types/Weather'
import { FUNCTIONS, userHeaders } from './http'

/**
 * Trail-Zustand from the `trail-condition` edge function.
 *
 * The function is the gate (JWT + `has_min_tier`) and owns Open-Meteo, the
 * water-balance model and its constants; this file only asks for the finished
 * view-model. The caller passes the user's access token, since communication/
 * must not reach into stores.
 */

export const TRAIL_CONDITION_CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_PREFIX = 'tr_wx_v2_'

function cacheKey(spotType: string, spotId: string): string {
  return `${CACHE_PREFIX}${spotType}_${spotId}`
}

interface CacheEntry {
  at: number
  condition: TrailConditionResponse
}

function isCondition(value: unknown): value is TrailConditionResponse {
  const v = value as TrailConditionResponse | null
  return !!v && typeof v.verdict?.level === 'string' && !!v.rainRule && !!v.current && Array.isArray(v.strip)
}

function readCache(key: string, now: number): TrailConditionResponse | null {
  // No localStorage during prerender, and it throws outright in some private
  // browsing modes — a missing cache must never take the page down.
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (!entry?.at || !isCondition(entry.condition)) throw new Error('corrupt cache entry')
    if (now - entry.at > TRAIL_CONDITION_CACHE_TTL_MS) return null
    return entry.condition
  } catch {
    // Corrupt entry — drop it rather than letting it poison every later read.
    clearCache(key)
    return null
  }
}

function writeCache(key: string, condition: TrailConditionResponse, now: number): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify({ at: now, condition } satisfies CacheEntry))
  } catch { /* quota or private mode — the fetch still succeeded, so carry on */ }
}

function clearCache(key: string): void {
  if (typeof localStorage === 'undefined') return
  try { localStorage.removeItem(key) } catch { /* nothing sensible left to do */ }
}

/**
 * Never throws and never rejects: the card is advisory, so a dead function, an
 * offline PWA or a refusal must degrade to "no card", not to a broken spot page.
 *
 * `onForbidden` fires on a 403 (the user is not entitled, e.g. a stale
 * entitlement in the browser) so the page can show the locked teaser instead of
 * an empty gap; a 403 also drops the cached card, so a downgraded user does not
 * keep seeing what they no longer pay for.
 */
export async function fetchTrailCondition(
  spotType: string,
  spotId: string,
  accessToken: string,
  onForbidden?: () => void,
): Promise<TrailConditionResponse | null> {
  const key = cacheKey(spotType, spotId)
  const now = Date.now()

  const cached = readCache(key, now)
  if (cached) return cached

  try {
    const res = await fetch(`${FUNCTIONS}/trail-condition`, {
      method: 'POST',
      headers: userHeaders(accessToken),
      body: JSON.stringify({ spotType, spotId }),
    })
    if (res.status === 403) {
      clearCache(key)
      onForbidden?.()
      return null
    }
    if (!res.ok) return null
    const body: unknown = await res.json()
    if (!isCondition(body)) return null
    writeCache(key, body, now)
    return body
  } catch {
    return null
  }
}
