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
  trail_description?: string;
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

async function deleteGpxFile(gpx_url: string, jwt: string): Promise<void> {
  const path = gpx_url.split('/gpx-files/')[1];
  if (!path) return;
  const res = await fetch(`${STORE}/object/gpx-files`, {
    method: 'DELETE', headers: headers(jwt), body: JSON.stringify({ prefixes: [path] }),
  });
  if (!res.ok) throw new Error(`Storage delete failed: ${await res.text()}`);
}

export async function deleteTrail(id: string, jwt: string, gpx_url?: string): Promise<void> {
  const res = await fetch(`${REST}/spot_gpx_trails?id=eq.${id}`, {
    method: 'DELETE', headers: headers(jwt),
  });
  if (!res.ok) throw new Error(`Delete failed: ${await res.text()}`);
  if (gpx_url) await deleteGpxFile(gpx_url, jwt);
}

export async function deleteTour(id: string, jwt: string, gpx_url?: string): Promise<void> {
  const res = await fetch(`${REST}/spot_gpx_tours?id=eq.${id}`, {
    method: 'DELETE', headers: headers(jwt),
  });
  if (!res.ok) throw new Error(`Delete failed: ${await res.text()}`);
  if (gpx_url) await deleteGpxFile(gpx_url, jwt);
}

export type SpotStatus  = 'open' | 'limited' | 'closed' | 'unknown';
export type AccessType  = 'free' | 'paid' | 'membership';
export type RainPolicy  = 'none' | 'during' | 'after';
export type NightPolicy = 'none' | 'dusk_to_dawn' | 'offset';

export interface SpotDetailsRow {
  trail_id: string;
  // Status
  status: SpotStatus;
  status_until?: string;          // YYYY-MM-DD
  status_hint: string;
  affected_trail_ids: string[];
  // Access / payment
  access_type: AccessType;
  donation_url?: string;
  // Content
  rules: string[];
  trail_description: string;
  opening_hours_text?: string;
  // Annual seasonal closure (MM-DD, repeats every year)
  seasonal_from?: string;
  seasonal_to?: string;
  // Rain policy
  rain_policy: RainPolicy;
  rain_closed_hours?: number;
  rain_window_from?: string;      // MM-DD
  rain_window_to?: string;        // MM-DD
  // Night / dusk policy
  night_policy: NightPolicy;
  night_before_dusk_min?: number;
  night_after_dawn_min?: number;
}

const SPOT_DETAILS_SELECT = [
  'trail_id', 'status', 'status_until', 'status_hint', 'affected_trail_ids',
  'access_type', 'donation_url',
  'rules', 'trail_description', 'opening_hours_text',
  'seasonal_from', 'seasonal_to',
  'rain_policy', 'rain_closed_hours', 'rain_window_from', 'rain_window_to',
  'night_policy', 'night_before_dusk_min', 'night_after_dawn_min',
].join(',');

export async function getSpotDetails(spotId: string, jwt: string): Promise<SpotDetailsRow | null> {
  const res = await fetch(`${REST}/trail_details?trail_id=eq.${spotId}&select=${SPOT_DETAILS_SELECT}&limit=1`, {
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

// ─── Embed token management ───────────────────────────────────────────────────

export interface EmbedTokenRow {
  id: string;
  token: string;
  name: string;
  allowed_hosts: string[];
  is_active: boolean;
  created_at: string;
}

export interface EmbedTokenTrailRow {
  id: string;
  token_id: string;
  trail_id: string;
  trail_type: 'trail' | 'bikepark' | 'dirtpark';
}

export interface TrailPickerRow {
  id: string;
  name: string;
  type: 'trail' | 'bikepark' | 'dirtpark';
}

export async function getEmbedTokens(jwt: string): Promise<EmbedTokenRow[]> {
  const res = await fetch(`${REST}/embed_tokens?select=*&order=created_at.desc`, {
    headers: headers(jwt),
  });
  return json<EmbedTokenRow[]>(res);
}

export async function createEmbedToken(
  row: Pick<EmbedTokenRow, 'name' | 'allowed_hosts'>,
  jwt: string,
): Promise<EmbedTokenRow> {
  const res = await fetch(`${REST}/embed_tokens`, {
    method: 'POST',
    headers: headers(jwt, { Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  });
  const data = await json<EmbedTokenRow | EmbedTokenRow[]>(res);
  return Array.isArray(data) ? data[0] : data;
}

export async function updateEmbedToken(
  id: string,
  patch: Partial<Pick<EmbedTokenRow, 'name' | 'allowed_hosts' | 'is_active'>>,
  jwt: string,
): Promise<EmbedTokenRow> {
  const res = await fetch(`${REST}/embed_tokens?id=eq.${id}`, {
    method: 'PATCH',
    headers: headers(jwt, { Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
  const data = await json<EmbedTokenRow | EmbedTokenRow[]>(res);
  return Array.isArray(data) ? data[0] : data;
}

export async function deleteEmbedToken(id: string, jwt: string): Promise<void> {
  const res = await fetch(`${REST}/embed_tokens?id=eq.${id}`, {
    method: 'DELETE',
    headers: headers(jwt),
  });
  if (!res.ok) throw new Error(`Delete embed token failed: ${await res.text()}`);
}

export async function getEmbedTokenTrails(tokenId: string, jwt: string): Promise<EmbedTokenTrailRow[]> {
  const res = await fetch(
    `${REST}/embed_token_trails?token_id=eq.${tokenId}&select=*`,
    { headers: headers(jwt) },
  );
  return json<EmbedTokenTrailRow[]>(res);
}

/** Replaces all trail associations for a token (delete-all + insert). */
export async function setEmbedTokenTrails(
  tokenId: string,
  trails: Array<{ trail_id: string; trail_type: string }>,
  jwt: string,
): Promise<void> {
  // Delete existing
  const del = await fetch(`${REST}/embed_token_trails?token_id=eq.${tokenId}`, {
    method: 'DELETE',
    headers: headers(jwt),
  });
  if (!del.ok) throw new Error(`Clear embed trail links failed: ${await del.text()}`);

  if (trails.length === 0) return;

  const rows = trails.map(t => ({ token_id: tokenId, ...t }));
  const ins = await fetch(`${REST}/embed_token_trails`, {
    method: 'POST',
    headers: headers(jwt, { Prefer: 'return=minimal' }),
    body: JSON.stringify(rows),
  });
  if (!ins.ok) throw new Error(`Insert embed trail links failed: ${await ins.text()}`);
}

/** Fetches a flat list of all trails (all types) for the token trail picker. */
export async function getAllTrailsForPicker(jwt: string): Promise<TrailPickerRow[]> {
  const fields = 'id,name';
  const [trailsRes, parksRes, dirtRes] = await Promise.all([
    fetch(`${REST}/trails?select=${fields}&order=name&visible=eq.true`, { headers: headers(jwt) }),
    fetch(`${REST}/parks?select=${fields}&order=name`, { headers: headers(jwt) }),
    fetch(`${REST}/dirt_parks?select=${fields}&order=name`, { headers: headers(jwt) }),
  ]);
  const [trails, parks, dirtParks] = await Promise.all([
    json<Array<{ id: string; name: string }>>(trailsRes),
    json<Array<{ id: string; name: string }>>(parksRes),
    json<Array<{ id: string; name: string }>>(dirtRes),
  ]);
  return [
    ...trails.map(t  => ({ ...t, type: 'trail'    as const })),
    ...parks.map(p   => ({ ...p, type: 'bikepark'  as const })),
    ...dirtParks.map(d => ({ ...d, type: 'dirtpark' as const })),
  ];
}
