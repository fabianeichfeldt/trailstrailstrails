import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchDemElevations } from './DemElevation';

const JWT = 'user-jwt';

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchDemElevations', () => {
  // Open Topo Data sends no CORS headers, so the browser must never call it directly.
  it('asks the dem-elevation edge function with the user JWT, never Open Topo Data', async () => {
    const fetchMock = vi.fn().mockReturnValue(respond(200, { elevations: [905.5, 906.1] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchDemElevations([[47.5, 10.7], [47.51, 10.71]], JWT);

    expect(result).toEqual([905.5, 906.1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/functions\/v1\/dem-elevation$/);
    expect(String(url)).not.toContain('opentopodata');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${JWT}`);
    expect(JSON.parse(init.body)).toEqual({ points: [[47.5, 10.7], [47.51, 10.71]] });
  });

  it('throws when the function reports the DEM as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(502, { error: 'dem_unavailable' })));
    await expect(fetchDemElevations([[47.5, 10.7]], JWT)).rejects.toThrow();
  });

  it('throws on a response that does not carry one finite elevation per point', async () => {
    for (const body of [{}, { elevations: [905.5] }, { elevations: [905.5, null] }]) {
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(200, body)));
      await expect(fetchDemElevations([[47.5, 10.7], [47.51, 10.71]], JWT)).rejects.toThrow();
    }
  });

  it('skips the request for an empty track', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchDemElevations([], JWT)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
