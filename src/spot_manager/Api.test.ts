import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getMyRole,
  getManageableSpots,
  uploadGpx,
  upsertTrail,
  upsertTour,
  deleteTrail,
  deleteTour,
  getSpotDetails,
  upsertSpotDetails,
  getEmbedTokens,
  createEmbedToken,
  updateEmbedToken,
  deleteEmbedToken,
  setEmbedTokenTrails,
  getAllTrailsForPicker,
  type GpxTrailRow,
  type GpxTourRow,
  type SpotDetailsRow,
  type EmbedTokenRow,
} from './Api';

// BASE URL defined in vitest.config.ts via `define`
const BASE = 'https://test.supabase.co';
const JWT = 'test-jwt';

function ok(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function err(status: number, text = 'error') {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ message: text }),
    text: () => Promise.resolve(text),
  });
}

afterEach(() => vi.unstubAllGlobals());

// ── getMyRole ─────────────────────────────────────────────────────────────────

describe('getMyRole', () => {
  it('returns role from RPC on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok('trailcrew')));
    expect(await getMyRole(JWT)).toBe('trailcrew');
  });

  it('falls back to user_roles table when RPC returns non-ok', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      ++call === 1 ? err(403, 'forbidden') : ok([{ role: 'admin' }]),
    ));
    expect(await getMyRole(JWT)).toBe('admin');
  });

  it('returns "user" when RPC fails and table is empty', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      ++call === 1 ? err(403) : ok([]),
    ));
    expect(await getMyRole(JWT)).toBe('user');
  });

  it('returns "user" when RPC returns null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok(null)));
    expect(await getMyRole(JWT)).toBe('user');
  });
});

// ── getManageableSpots ────────────────────────────────────────────────────────

describe('getManageableSpots', () => {
  it('admin path queries all trails ordered by name', async () => {
    const fetch = vi.fn().mockReturnValue(ok([{ id: 's1', name: 'Spot 1' }]));
    vi.stubGlobal('fetch', fetch);
    const result = await getManageableSpots(JWT, 'uid', 'admin');
    expect(result).toEqual([{ id: 's1', name: 'Spot 1' }]);
    expect(fetch.mock.calls[0][0]).toContain('/trails?select=id,name');
  });

  it('trailcrew path filters by user_id', async () => {
    const rows = [{ trails: { id: 's1', name: 'Spot 1' } }];
    const fetch = vi.fn().mockReturnValue(ok(rows));
    vi.stubGlobal('fetch', fetch);
    const result = await getManageableSpots(JWT, 'uid-abc', 'trailcrew');
    expect(result).toEqual([{ id: 's1', name: 'Spot 1' }]);
    expect(fetch.mock.calls[0][0]).toContain('user_id=eq.uid-abc');
  });

  it('trailcrew path filters out null trail refs', async () => {
    const rows = [{ trails: { id: 's1', name: 'Spot 1' } }, { trails: null }];
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok(rows)));
    const result = await getManageableSpots(JWT, 'uid', 'trailcrew');
    expect(result).toHaveLength(1);
  });
});

// ── uploadGpx ─────────────────────────────────────────────────────────────────

describe('uploadGpx', () => {
  it('sanitizes spaces to underscores in the storage path', async () => {
    const fetch = vi.fn().mockReturnValue(ok({}));
    vi.stubGlobal('fetch', fetch);
    await uploadGpx('spot1', 'trails', 'my trail.gpx', '<gpx/>', JWT);
    expect(fetch.mock.calls[0][0]).toContain('my_trail.gpx');
  });

  it('removes characters outside [a-zA-Z0-9._-] from filename', async () => {
    const fetch = vi.fn().mockReturnValue(ok({}));
    vi.stubGlobal('fetch', fetch);
    await uploadGpx('spot1', 'trails', 'héllo!.gpx', '<gpx/>', JWT);
    const url: string = fetch.mock.calls[0][0];
    expect(url).toContain('hllo.gpx');
    expect(url).not.toContain('!');
  });

  it('uses POST on the first attempt', async () => {
    const fetch = vi.fn().mockReturnValue(ok({}));
    vi.stubGlobal('fetch', fetch);
    await uploadGpx('spot1', 'trails', 'trail.gpx', '<gpx/>', JWT);
    expect(fetch.mock.calls[0][1].method).toBe('POST');
  });

  it('returns a public storage URL on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok({})));
    const url = await uploadGpx('spot1', 'trails', 'trail.gpx', '<gpx/>', JWT);
    expect(url).toBe(`${BASE}/storage/v1/object/public/gpx-files/spot1/trails/trail.gpx`);
  });

  it('falls back to PUT when POST fails (file already exists)', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      ++call === 1 ? err(409, 'already exists') : ok({}),
    ));
    const url = await uploadGpx('spot1', 'trails', 'trail.gpx', '<gpx/>', JWT);
    expect(call).toBe(2);
    expect(url).toContain('trail.gpx');
  });

  it('throws when both POST and PUT fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(500, 'server error')));
    await expect(uploadGpx('spot1', 'trails', 'trail.gpx', '<gpx/>', JWT))
      .rejects.toThrow('GPX upload failed');
  });
});

// ── upsertTrail ───────────────────────────────────────────────────────────────

describe('upsertTrail', () => {
  const TRAIL: GpxTrailRow = {
    id: 't1', spot_id: 's1', name: 'Trail 1',
    difficulty: 'blue', direction: 'one-way-down',
    distance_km: 1.2, elevation_gain: 80, elevation_loss: 80, gpx_points: [],
  };

  it('uses POST for a new record (no id field)', async () => {
    const { id: _id, ...newTrail } = TRAIL;
    const fetch = vi.fn().mockReturnValue(ok([{ ...newTrail, id: 'new-id' }]));
    vi.stubGlobal('fetch', fetch);
    await upsertTrail({ ...newTrail, spot_id: 's1' }, JWT);
    expect(fetch.mock.calls[0][1].method).toBe('POST');
    expect(fetch.mock.calls[0][0]).not.toContain('id=eq.');
  });

  it('uses PATCH for an existing record (has id)', async () => {
    const fetch = vi.fn().mockReturnValue(ok([TRAIL]));
    vi.stubGlobal('fetch', fetch);
    await upsertTrail(TRAIL, JWT);
    expect(fetch.mock.calls[0][1].method).toBe('PATCH');
    expect(fetch.mock.calls[0][0]).toContain('id=eq.t1');
  });

  it('unwraps an array response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([TRAIL])));
    expect(await upsertTrail(TRAIL, JWT)).toEqual(TRAIL);
  });

  it('accepts a single-object response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok(TRAIL)));
    expect(await upsertTrail(TRAIL, JWT)).toEqual(TRAIL);
  });

  it('sends Prefer: return=representation header', async () => {
    const fetch = vi.fn().mockReturnValue(ok([TRAIL]));
    vi.stubGlobal('fetch', fetch);
    await upsertTrail(TRAIL, JWT);
    expect(fetch.mock.calls[0][1].headers['Prefer']).toContain('return=representation');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(400, 'bad request')));
    await expect(upsertTrail(TRAIL, JWT)).rejects.toThrow('400');
  });
});

// ── upsertTour ────────────────────────────────────────────────────────────────

describe('upsertTour', () => {
  const TOUR: GpxTourRow = {
    id: 'tour1', spot_id: 's1', name: 'Tour 1',
    direction: 'cw', duration_minutes: 60, trail_names: ['T1'],
    distance_km: 5.0, elevation_gain: 200, elevation_loss: 200, gpx_points: [],
  };

  it('uses POST for a new tour (no id)', async () => {
    const { id: _id, ...newTour } = TOUR;
    const fetch = vi.fn().mockReturnValue(ok([{ ...newTour, id: 'new-id' }]));
    vi.stubGlobal('fetch', fetch);
    await upsertTour({ ...newTour, spot_id: 's1' }, JWT);
    expect(fetch.mock.calls[0][1].method).toBe('POST');
  });

  it('uses PATCH for an existing tour (has id)', async () => {
    const fetch = vi.fn().mockReturnValue(ok([TOUR]));
    vi.stubGlobal('fetch', fetch);
    await upsertTour(TOUR, JWT);
    expect(fetch.mock.calls[0][1].method).toBe('PATCH');
    expect(fetch.mock.calls[0][0]).toContain('id=eq.tour1');
  });

  it('unwraps an array response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([TOUR])));
    expect(await upsertTour(TOUR, JWT)).toEqual(TOUR);
  });
});

// ── deleteTrail / deleteTour ──────────────────────────────────────────────────

describe('deleteTrail', () => {
  it('sends DELETE to the correct endpoint', async () => {
    const fetch = vi.fn().mockReturnValue(ok(null));
    vi.stubGlobal('fetch', fetch);
    await deleteTrail('t1', JWT);
    expect(fetch.mock.calls[0][0]).toContain('spot_gpx_trails?id=eq.t1');
    expect(fetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(404, 'not found')));
    await expect(deleteTrail('t1', JWT)).rejects.toThrow('Delete failed');
  });
});

describe('deleteTour', () => {
  it('sends DELETE to the correct endpoint', async () => {
    const fetch = vi.fn().mockReturnValue(ok(null));
    vi.stubGlobal('fetch', fetch);
    await deleteTour('tour1', JWT);
    expect(fetch.mock.calls[0][0]).toContain('spot_gpx_tours?id=eq.tour1');
    expect(fetch.mock.calls[0][1].method).toBe('DELETE');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(500, 'server error')));
    await expect(deleteTour('tour1', JWT)).rejects.toThrow('Delete failed');
  });
});

// ── getSpotDetails ────────────────────────────────────────────────────────────

describe('getSpotDetails', () => {
  const DETAILS: SpotDetailsRow = {
    trail_id: 's1', status: 'open', status_hint: '',
    affected_trail_ids: [], access_type: 'free',
    rules: [], trail_description: '',
    rain_policy: 'none', night_policy: 'none',
  };

  it('returns null when no row exists (empty array)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([])));
    expect(await getSpotDetails('s1', JWT)).toBeNull();
  });

  it('returns the first row when details exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([DETAILS])));
    expect(await getSpotDetails('s1', JWT)).toEqual(DETAILS);
  });

  it('queries by trail_id', async () => {
    const fetch = vi.fn().mockReturnValue(ok([DETAILS]));
    vi.stubGlobal('fetch', fetch);
    await getSpotDetails('spot-xyz', JWT);
    expect(fetch.mock.calls[0][0]).toContain('trail_id=eq.spot-xyz');
  });
});

// ── upsertSpotDetails ─────────────────────────────────────────────────────────

describe('upsertSpotDetails', () => {
  const DETAILS: SpotDetailsRow = {
    trail_id: 's1', status: 'closed', status_hint: 'Mud season',
    affected_trail_ids: [], access_type: 'free',
    rules: [], trail_description: '',
    rain_policy: 'none', night_policy: 'none',
  };

  it('uses resolution=merge-duplicates for upsert', async () => {
    const fetch = vi.fn().mockReturnValue(ok([DETAILS]));
    vi.stubGlobal('fetch', fetch);
    await upsertSpotDetails(DETAILS, JWT);
    expect(fetch.mock.calls[0][1].headers['Prefer']).toContain('merge-duplicates');
  });

  it('unwraps an array response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([DETAILS])));
    expect(await upsertSpotDetails(DETAILS, JWT)).toEqual(DETAILS);
  });

  it('accepts a single-object response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok(DETAILS)));
    expect(await upsertSpotDetails(DETAILS, JWT)).toEqual(DETAILS);
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(422, 'unprocessable')));
    await expect(upsertSpotDetails(DETAILS, JWT)).rejects.toThrow('422');
  });
});

// ── Embed token CRUD ──────────────────────────────────────────────────────────

const TOKEN: EmbedTokenRow = {
  id: 'tok-1', token: 'abc123', name: 'Test Embed',
  allowed_hosts: ['localhost'], is_active: true, created_at: '2026-01-01T00:00:00Z',
};

describe('getEmbedTokens', () => {
  it('fetches and returns list of tokens', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([TOKEN])));
    expect(await getEmbedTokens(JWT)).toEqual([TOKEN]);
  });
});

describe('createEmbedToken', () => {
  it('POSTs and returns the created token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([TOKEN])));
    const result = await createEmbedToken({ name: 'Test Embed', allowed_hosts: ['localhost'] }, JWT);
    expect(result).toEqual(TOKEN);
  });

  it('unwraps a single-object response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok(TOKEN)));
    expect(await createEmbedToken({ name: 'Test Embed', allowed_hosts: [] }, JWT)).toEqual(TOKEN);
  });
});

describe('updateEmbedToken', () => {
  it('PATCHes and returns the updated token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([{ ...TOKEN, name: 'Renamed' }])));
    const result = await updateEmbedToken('tok-1', { name: 'Renamed' }, JWT);
    expect(result.name).toBe('Renamed');
  });
});

describe('deleteEmbedToken', () => {
  it('sends DELETE and resolves on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok(null)));
    await expect(deleteEmbedToken('tok-1', JWT)).resolves.toBeUndefined();
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(403, 'forbidden')));
    await expect(deleteEmbedToken('tok-1', JWT)).rejects.toThrow();
  });
});

describe('setEmbedTokenTrails', () => {
  it('DELETEs existing links then POSTs new ones', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      calls.push(init.method as string);
      return ok(null);
    }));
    await setEmbedTokenTrails('tok-1', [{ trail_id: 't1', trail_type: 'trail' }], JWT);
    expect(calls).toEqual(['DELETE', 'POST']);
  });

  it('only DELETEs when trails array is empty', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      calls.push(init.method as string);
      return ok(null);
    }));
    await setEmbedTokenTrails('tok-1', [], JWT);
    expect(calls).toEqual(['DELETE']);
  });
});

describe('getAllTrailsForPicker', () => {
  it('merges trails, bikeparks, and dirtparks with correct type labels', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const bodies = [
        [{ id: 't1', name: 'Trail A' }],
        [{ id: 'p1', name: 'Park B' }],
        [{ id: 'd1', name: 'Dirt C' }],
      ];
      return ok(bodies[call++]);
    }));
    const result = await getAllTrailsForPicker(JWT);
    expect(result).toEqual([
      { id: 't1', name: 'Trail A', type: 'trail' },
      { id: 'p1', name: 'Park B', type: 'bikepark' },
      { id: 'd1', name: 'Dirt C', type: 'dirtpark' },
    ]);
  });
});
