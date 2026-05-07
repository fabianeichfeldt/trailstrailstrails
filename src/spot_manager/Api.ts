import { anon } from '../anon';

const BASE = import.meta.env.VITE_SUPABASE_URL as string;
const REST  = `${BASE}/rest/v1`;
const STORE = `${BASE}/storage/v1`;

function headers(jwt: string, extra?: Record<string, string>) {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${jwt}`,
    'apikey':        anon,
    ...extra,
  };
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export interface SpotRow { id: string; name: string }
export interface GpxTrailRow {
  id: string;
  spot_id: string;
  name: string;
  difficulty: string;
  direction: string;
  distance_km: number;
  elevation_gain: number;
  elevation_loss: number;
  gpx_points: [number, number, number][];
  gpx_url?: string;
}
export interface GpxTourRow {
  id: string;
  spot_id: string;
  name: string;
  direction: string;
  duration_minutes: number;
  trail_names: string[] | null;
  distance_km: number;
  elevation_gain: number;
  elevation_loss: number;
  gpx_points: [number, number, number][];
  gpx_url?: string;
}

export async function getMyRole(jwt: string): Promise<'admin' | 'trailcrew' | 'user'> {
  // Use SECURITY DEFINER RPC — bypasses RLS, always returns the caller's role.
  const res = await fetch(`${BASE}/rest/v1/rpc/get_my_role`, {
    method: 'POST',
    headers: headers(jwt),
    body: '{}',
  });
  if (!res.ok) {
    console.warn('get_my_role RPC failed, falling back to table query', await res.text());
    // Fallback: direct table query (requires correct RLS SELECT policy)
    const r2 = await fetch(`${REST}/user_roles?select=role&limit=1`, { headers: headers(jwt) });
    const data = await r2.json();
    return data[0]?.role ?? 'user';
  }
  const role = await res.json();
  return role ?? 'user';
}

export async function getManageableSpots(jwt: string, userId: string, role: string): Promise<SpotRow[]> {
  if (role === 'admin') {
    const res = await fetch(`${REST}/trails?select=id,name&order=name`, { headers: headers(jwt) });
    return json<SpotRow[]>(res);
  }
  const res = await fetch(
    `${REST}/trailcrew_spots?select=spot_id,trails(id,name)&user_id=eq.${userId}`,
    { headers: headers(jwt) }
  );
  const rows = await json<Array<{ trails: SpotRow }>>(res);
  return rows.map(r => r.trails).filter(Boolean);
}

export async function getSpotTrails(spotId: string, jwt: string): Promise<GpxTrailRow[]> {
  const res = await fetch(`${REST}/spot_gpx_trails?select=*&spot_id=eq.${spotId}&order=name`, {
    headers: headers(jwt),
  });
  return json<GpxTrailRow[]>(res);
}

export async function getSpotTours(spotId: string, jwt: string): Promise<GpxTourRow[]> {
  const res = await fetch(`${REST}/spot_gpx_tours?select=*&spot_id=eq.${spotId}&order=name`, {
    headers: headers(jwt),
  });
  return json<GpxTourRow[]>(res);
}

export async function uploadGpx(
  spotId: string,
  kind: 'trails' | 'tours',
  filename: string,
  content: string,
  jwt: string,
): Promise<string> {
  const safe = filename.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const path = `${spotId}/${kind}/${safe}`;
  const gpxHeaders = {
    'Authorization': `Bearer ${jwt}`,
    'Content-Type':  'application/gpx+xml',
  };
  let res = await fetch(`${STORE}/object/gpx-files/${path}`, { method: 'POST', headers: gpxHeaders, body: content });
  if (!res.ok) {
    // File already exists — overwrite
    res = await fetch(`${STORE}/object/gpx-files/${path}`, { method: 'PUT', headers: gpxHeaders, body: content });
    if (!res.ok) throw new Error(`GPX upload failed: ${await res.text()}`);
  }
  return `${STORE}/object/public/gpx-files/${path}`;
}

export async function upsertTrail(row: Partial<GpxTrailRow> & { spot_id: string }, jwt: string): Promise<GpxTrailRow> {
  const isNew = !row.id;
  const url   = isNew ? `${REST}/spot_gpx_trails` : `${REST}/spot_gpx_trails?id=eq.${row.id}`;
  const res = await fetch(url, {
    method:  isNew ? 'POST' : 'PATCH',
    headers: headers(jwt, { Prefer: 'return=representation' }),
    body:    JSON.stringify(row),
  });
  const data = await json<GpxTrailRow | GpxTrailRow[]>(res);
  return Array.isArray(data) ? data[0] : data;
}

export async function upsertTour(row: Partial<GpxTourRow> & { spot_id: string }, jwt: string): Promise<GpxTourRow> {
  const isNew = !row.id;
  const url   = isNew ? `${REST}/spot_gpx_tours` : `${REST}/spot_gpx_tours?id=eq.${row.id}`;
  const res = await fetch(url, {
    method:  isNew ? 'POST' : 'PATCH',
    headers: headers(jwt, { Prefer: 'return=representation' }),
    body:    JSON.stringify(row),
  });
  const data = await json<GpxTourRow | GpxTourRow[]>(res);
  return Array.isArray(data) ? data[0] : data;
}

export async function deleteTrail(id: string, jwt: string): Promise<void> {
  const res = await fetch(`${REST}/spot_gpx_trails?id=eq.${id}`, {
    method: 'DELETE', headers: headers(jwt),
  });
  if (!res.ok) throw new Error(`Delete failed: ${await res.text()}`);
}

export async function deleteTour(id: string, jwt: string): Promise<void> {
  const res = await fetch(`${REST}/spot_gpx_tours?id=eq.${id}`, {
    method: 'DELETE', headers: headers(jwt),
  });
  if (!res.ok) throw new Error(`Delete failed: ${await res.text()}`);
}

export type SpotStatus = 'open' | 'limited' | 'seasonal' | 'closed';

export interface SpotDetailsRow {
  trail_id: string;
  status: SpotStatus;
  status_hint: string;
  rules: string[];
  trail_description: string;
}

export async function getSpotDetails(spotId: string, jwt: string): Promise<SpotDetailsRow | null> {
  const res = await fetch(`${REST}/trail_details?trail_id=eq.${spotId}&select=trail_id,status,status_hint,rules,trail_description&limit=1`, {
    headers: headers(jwt),
  });
  const data = await json<SpotDetailsRow[]>(res);
  return data[0] ?? null;
}

export async function upsertSpotDetails(row: SpotDetailsRow, jwt: string): Promise<SpotDetailsRow> {
  const res = await fetch(`${REST}/trail_details`, {
    method: 'POST',
    headers: headers(jwt, { Prefer: 'return=representation,resolution=merge-duplicates' }),
    body: JSON.stringify(row),
  });
  const data = await json<SpotDetailsRow | SpotDetailsRow[]>(res);
  return Array.isArray(data) ? data[0] : data;
}
