import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchMultipleSpotParking, toElevationProfile } from './trails'

function ok(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

function err(status: number, text = 'error') {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ message: text }),
    text: () => Promise.resolve(text),
  })
}

afterEach(() => vi.unstubAllGlobals())

// ── fetchMultipleSpotParking ────────────────────────────────────────────────

describe('fetchMultipleSpotParking', () => {
  it('returns an empty Map without calling fetch when given no spot IDs', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const result = await fetchMultipleSpotParking([])
    expect(result).toEqual(new Map())
    expect(fetch).not.toHaveBeenCalled()
  })

  it('groups multiple lots by spot_id, including spots with zero lots', async () => {
    const rows = [
      { id: 'p1', spot_id: 's1', name: 'Lot A', lat: 47.8, lng: 13.0, info: [] },
      { id: 'p2', spot_id: 's1', name: 'Lot B', lat: 47.9, lng: 13.1, info: ['Kosten: kostenlos'] },
      { id: 'p3', spot_id: 's2', name: 'Lot C', lat: 48.0, lng: 13.2, info: null },
    ]
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok(rows)))
    const result = await fetchMultipleSpotParking(['s1', 's2', 's3'])

    expect(result.get('s1')?.map(l => l.id)).toEqual(['p1', 'p2'])
    expect(result.get('s2')?.map(l => l.id)).toEqual(['p3'])
    expect(result.get('s3')).toEqual([])
  })

  it('applies a spot_id=in.(...) filter with all requested IDs', async () => {
    const fetch = vi.fn().mockReturnValue(ok([]))
    vi.stubGlobal('fetch', fetch)
    await fetchMultipleSpotParking(['s1', 's2'])
    const url: string = fetch.mock.calls[0][0]
    expect(url).toContain('spot_id=in.(s1,s2)')
  })

  it('throws when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(500, 'server error')))
    await expect(fetchMultipleSpotParking(['s1'])).rejects.toThrow('parking fetch failed')
  })
})

// ── toElevationProfile ───────────────────────────────────────────────────────

describe('toElevationProfile', () => {
  it('returns empty array for empty input', () => {
    expect(toElevationProfile([])).toEqual([])
  })

  it('first point always has dist 0', () => {
    const points: [number, number, number][] = [
      [48.0, 11.5, 500],
      [48.001, 11.501, 510],
    ]
    const profile = toElevationProfile(points)
    expect(profile[0].dist).toBe(0)
  })

  it('distance increases for subsequent points', () => {
    const points: [number, number, number][] = [
      [48.0, 11.5, 500],
      [48.01, 11.51, 520],
      [48.02, 11.52, 540],
    ]
    const profile = toElevationProfile(points)
    expect(profile[1].dist).toBeGreaterThan(0)
    expect(profile[2].dist).toBeGreaterThan(profile[1].dist)
  })

  it('preserves altitude values', () => {
    const points: [number, number, number][] = [
      [48.0, 11.5, 500],
      [48.001, 11.501, 600],
    ]
    const profile = toElevationProfile(points)
    expect(profile[0].alt).toBe(500)
    expect(profile[1].alt).toBe(600)
  })

  it('does not collapse closely-spaced points onto the same distance bucket', () => {
    // Points ~11m apart. Rounding cumulative distance to 0.1km/100m — as
    // this function used to do — gave every one of these nine points the
    // same `dist`, corrupting the SpotPanel elevation chart's x-axis for
    // short/technical trails (see app/map/spot_panel/elevationSvg.ts, which
    // positions each plotted point by `dist`).
    const points: [number, number, number][] = Array.from({ length: 9 }, (_, i) => [
      48.0 + i * 0.0001, 11.5, 500 + i,
    ])
    const profile = toElevationProfile(points)
    const dists = profile.map(p => p.dist)
    expect(new Set(dists).size).toBe(dists.length)
  })
})
