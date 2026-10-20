import type { TrailConditionResponse } from '~/types/Weather'
import type { GatedAdapter, GatedResponse } from '~/entitlements/gatedFetch'
import { FUNCTIONS, userHeaders } from './http'

/**
 * Trail-Zustand from the `trail-condition` edge function.
 *
 * The function is the gate (JWT + `has_min_tier`) and owns Open-Meteo, the
 * water-balance model and its constants; this file only asks for the finished
 * view-model. The caller passes the user's access token, since communication/
 * must not reach into stores. Caching, 403 handling and ownership live in
 * `~/entitlements/gatedFetch`; this file is the feature's adapter.
 */

export interface ConditionSource {
  spotType: string
  spotId: string
}

export const TRAIL_CONDITION_CACHE_TTL_MS = 60 * 60 * 1000
// v3: the verdict gained `range`; a v2 entry would hide the feedback link for up to an hour.
const CACHE_PREFIX = 'tr_wx_v3_'

function isCondition(value: unknown): value is TrailConditionResponse {
  const v = value as TrailConditionResponse | null
  return !!v && typeof v.verdict?.level === 'string' && !!v.rainRule && !!v.current && Array.isArray(v.strip)
}

/**
 * One request, never throws. `at` (ISO instant, at most 3 days back) asks for the
 * verdict at that moment only.
 */
export async function requestTrailCondition(
  accessToken: string,
  { spotType, spotId }: ConditionSource,
  at?: string,
): Promise<GatedResponse<TrailConditionResponse>> {
  try {
    const res = await fetch(`${FUNCTIONS}/trail-condition`, {
      method: 'POST',
      headers: userHeaders(accessToken),
      body: JSON.stringify(at ? { spotType, spotId, at } : { spotType, spotId }),
    })
    if (res.status === 403) return { kind: 'forbidden' }
    if (!res.ok) return { kind: 'failed' }
    const body: unknown = await res.json()
    return isCondition(body) ? { kind: 'ok', data: body } : { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

/** Uncached one-off fetch (e.g. the verdict for a past instant); null on any failure. */
export async function fetchTrailCondition(
  spotType: string,
  spotId: string,
  accessToken: string,
  onForbidden?: () => void,
  at?: string,
): Promise<TrailConditionResponse | null> {
  const res = await requestTrailCondition(accessToken, { spotType, spotId }, at)
  if (res.kind === 'forbidden') onForbidden?.()
  return res.kind === 'ok' ? res.data : null
}

export const trailConditionAdapter: GatedAdapter<ConditionSource, TrailConditionResponse> = {
  feature: 'trail_condition',
  cachePrefix: CACHE_PREFIX,
  cacheKey: ({ spotType, spotId }) => `${CACHE_PREFIX}${spotType}_${spotId}`,
  request: (token, source) => requestTrailCondition(token, source),
  isValid: isCondition,
  isFresh: (entry, now) => now - entry.at <= TRAIL_CONDITION_CACHE_TTL_MS,
  offlineFallback: false,
}
