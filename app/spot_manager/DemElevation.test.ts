import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchDemElevations } from './DemElevation';

function ok(results: Array<{ elevation: number | null }>) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ status: 'OK', results }),
    text: () => Promise.resolve(''),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchDemElevations', () => {
  it('returns the elevation for each location on a clean response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([{ elevation: 905.5 }, { elevation: 906.1 }])));
    const result = await fetchDemElevations([[47.5, 10.7], [47.51, 10.71]]);
    expect(result).toEqual([905.5, 906.1]);
  });

  // Open Topo Data returns HTTP 200 / status "OK" with elevation: null for a
  // location outside the dataset's coverage (documented behaviour, not an
  // error). Math.round(null) === 0, so if this slips through uncaught it
  // silently corrupts a real mountain trail's altitude to 0 instead of
  // falling back to the recorded GPX altitude.
  it('throws instead of silently returning null elevation for an out-of-coverage point', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(
      ok([{ elevation: 905.5 }, { elevation: null }]),
    ));
    await expect(fetchDemElevations([[47.5, 10.7], [47.51, 10.71]])).rejects.toThrow();
  });

  it('retries a transient failure before giving up', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve('unavailable') });
      return ok([{ elevation: 905.5 }]);
    }));
    const result = await fetchDemElevations([[47.5, 10.7]]);
    expect(result).toEqual([905.5]);
    expect(call).toBe(2);
  });

  it('gives up and throws after repeated failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(
      Promise.resolve({ ok: false, status: 503, text: () => Promise.resolve('unavailable') }),
    ));
    await expect(fetchDemElevations([[47.5, 10.7]])).rejects.toThrow();
  });
});
