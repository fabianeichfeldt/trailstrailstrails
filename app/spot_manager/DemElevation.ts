// DEM elevation lookup, used to replace recorded GPX altitude (often noisy,
// e.g. Komoot exports) with terrain-model elevation. Goes through the
// `dem-elevation` edge function (trailradar-backend): Open Topo Data sends no
// CORS headers, so the browser can't call it directly. The function does the
// chunking, rate limiting and retries, and is trailcrew/admin only.
// See also scripts/backfill-dem-elevation.js, which corrects existing rows.

import { FUNCTIONS, userHeaders } from '../communication/http';

/**
 * DEM elevation (meters) for each [lat, lng], in input order. Throws when the
 * lookup fails or any point has no elevation, so the caller can fall back to
 * the recorded GPX altitude instead of storing 0 m.
 */
export async function fetchDemElevations(latLngs: [number, number][], jwt: string): Promise<number[]> {
  if (latLngs.length === 0) return [];
  const res = await fetch(`${FUNCTIONS}/dem-elevation`, {
    method: 'POST',
    headers: userHeaders(jwt),
    body: JSON.stringify({ points: latLngs }),
  });
  if (!res.ok) throw new Error(`DEM lookup failed (${res.status}): ${await res.text()}`);
  const { elevations } = await res.json() as { elevations?: unknown };
  if (
    !Array.isArray(elevations) ||
    elevations.length !== latLngs.length ||
    !elevations.every(e => typeof e === 'number' && Number.isFinite(e))
  ) {
    throw new Error('DEM lookup returned no elevation for some points');
  }
  return elevations as number[];
}
