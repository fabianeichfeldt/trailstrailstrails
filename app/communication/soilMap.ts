import type { SoilMapResponse } from '~/types/SoilMap'
import type { GatedAdapter, GatedResponse } from '~/entitlements/gatedFetch'
import { FUNCTIONS, userHeaders } from './http'

/**
 * Boden-Radar snapshot from the `soil-map` edge function (the gate: JWT +
 * `has_min_tier`). The caller passes the access token; communication/ must not
 * reach into stores. Caching, 403 handling and ownership live in
 * `~/entitlements/gatedFetch`; this file is the feature's adapter.
 */

// v2: entries carry their fetch time and follow the backend's nextRunAt.
const CACHE_KEY = 'tr_soil_v2'
// The backend job needs a moment after each slot before the new snapshot is readable.
const GRACE_MS = 10 * 60 * 1000
// Only for responses without `nextRunAt` (a backend from before that field).
const FALLBACK_TTL_MS = 60 * 60 * 1000

function isSoilMap(value: unknown): value is SoilMapResponse {
  const v = value as SoilMapResponse | null
  return !!v && typeof v.computedAt === 'string' && !Number.isNaN(Date.parse(v.computedAt)) && Array.isArray(v.spots)
}

/** One request, never throws. */
export async function requestSoilMap(accessToken: string): Promise<GatedResponse<SoilMapResponse>> {
  try {
    const res = await fetch(`${FUNCTIONS}/soil-map`, { method: 'POST', headers: userHeaders(accessToken) })
    if (res.status === 403) return { kind: 'forbidden' }
    if (!res.ok) return { kind: 'failed' }
    const body: unknown = await res.json()
    return isSoilMap(body) ? { kind: 'ok', data: body } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

export const soilMapAdapter: GatedAdapter<void, SoilMapResponse> = {
  feature: 'soil_radar',
  cachePrefix: CACHE_KEY,
  cacheKey: () => CACHE_KEY,
  request: (token) => requestSoilMap(token),
  isValid: isSoilMap,
  // The backend owns the schedule: cache until its next run (plus time for the job to finish).
  isFresh: (entry, now) => {
    const nextRun = Date.parse(entry.data.nextRunAt ?? '')
    if (!Number.isNaN(nextRun)) return now <= nextRun + GRACE_MS
    return now <= entry.at + FALLBACK_TTL_MS
  },
  // A stale snapshot beats an empty map when the network is gone.
  offlineFallback: true,
}
