import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchMultipleSpotGpx, fetchMultipleSpotParking, toElevationProfile, getTrailBySlug } from './trails'

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

// ── fetchMultipleSpotGpx ────────────────────────────────────────────────────

describe('fetchMultipleSpotGpx', () => {
  function routeFetch(tables: { spot_gpx_trails?: unknown[]; spot_gpx_tours?: unknown[] }) {
    return vi.fn((url: string) => {
      const table = String(url).split('/rest/v1/')[1]?.split('?')[0]
      return ok((tables as Record<string, unknown[]>)[table] ?? [])
    })
  }

  it('returns an empty Map without calling fetch when given no spot IDs', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const result = await fetchMultipleSpotGpx([])
    expect(result).toEqual(new Map())
    expect(fetch).not.toHaveBeenCalled()
  })

  it('scopes both requests to the requested spot IDs (no whole-table scan)', async () => {
    const fetch = routeFetch({})
    vi.stubGlobal('fetch', fetch)
    await fetchMultipleSpotGpx(['s1', 's2'])

    const urls = fetch.mock.calls.map(c => String(c[0]))
    const trailsUrl = urls.find(u => u.includes('/spot_gpx_trails'))!
    const toursUrl = urls.find(u => u.includes('/spot_gpx_tours'))!
    expect(trailsUrl).toContain('spot_id=in.(s1,s2)')
    expect(toursUrl).toContain('spot_id=in.(s1,s2)')
  })

  it('URL-encodes spot IDs in the filter', async () => {
    const fetch = routeFetch({})
    vi.stubGlobal('fetch', fetch)
    await fetchMultipleSpotGpx(['a b', 's/2'])

    const trailsUrl = fetch.mock.calls.map(c => String(c[0])).find(u => u.includes('/spot_gpx_trails'))!
    expect(trailsUrl).toContain('spot_id=in.(a%20b,s%2F2)')
  })

  it('groups trails and tours by spot_id, including spots with no GPX', async () => {
    const fetch = routeFetch({
      spot_gpx_trails: [
        { spot_id: 's1', name: 'T1', difficulty: 'S1', gpx_points: [[47, 13, 0]] },
        { spot_id: 's2', name: 'T2', difficulty: 'S2', gpx_points: [[48, 14, 0]] },
      ],
      spot_gpx_tours: [
        { spot_id: 's1', name: 'Tour 1', gpx_points: [[47, 13, 0]] },
      ],
    })
    vi.stubGlobal('fetch', fetch)
    const result = await fetchMultipleSpotGpx(['s1', 's2', 's3'])

    expect(result.get('s1')?.trails.map(t => t.name)).toEqual(['T1'])
    expect(result.get('s1')?.tours.map(t => t.name)).toEqual(['Tour 1'])
    expect(result.get('s2')?.trails.map(t => t.name)).toEqual(['T2'])
    expect(result.get('s3')).toEqual({ trails: [], tours: [] })
  })

  it('throws when a request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(500, 'server error')))
    await expect(fetchMultipleSpotGpx(['s1'])).rejects.toThrow('spot_gpx_trails fetch failed')
  })
})

// ── getTrailBySlug ───────────────────────────────────────────────────────────

describe('getTrailBySlug', () => {
  function routeFetch(tables: {
    trails?: unknown[]; parks?: unknown[]; dirt_parks?: unknown[]
    trail_details?: unknown[]; trail_photos?: unknown[]
  }) {
    return vi.fn((url: string) => {
      const table = String(url).split('/rest/v1/')[1]?.split('?')[0]
      return ok((tables as Record<string, unknown[]>)[table] ?? [])
    })
  }

  it('resolves a trail by its slug and merges details + photos', async () => {
    vi.stubGlobal('fetch', routeFetch({
      trails: [{ id: 't-uuid', slug: 'flowtrail-kelkheim', name: 'Flowtrail Kelkheim', latitude: 50.1, longitude: 8.4 }],
      trail_details: [{ trail_id: 't-uuid', trail_description: 'Nice' }],
      trail_photos: [{ id: 'ph1', url: 'https://x/1.jpg' }],
    }))

    const res = await getTrailBySlug('flowtrail-kelkheim')
    expect(res).toMatchObject({
      id: 't-uuid',
      slug: 'flowtrail-kelkheim',
      type: 'trail',
      trail_description: 'Nice',
    })
    expect(res!.photos).toHaveLength(1)
  })

  it('falls through the three spot tables and tags the type', async () => {
    vi.stubGlobal('fetch', routeFetch({
      dirt_parks: [{ id: 'd-uuid', slug: 'pumptrack-muc', name: 'Pumptrack', latitude: 48, longitude: 11 }],
    }))
    const res = await getTrailBySlug('pumptrack-muc')
    expect(res).toMatchObject({ id: 'd-uuid', type: 'dirtpark' })
  })

  it('returns null when no spot owns the slug', async () => {
    vi.stubGlobal('fetch', routeFetch({}))
    expect(await getTrailBySlug('does-not-exist')).toBeNull()
  })

  it('URL-encodes the slug in the query', async () => {
    const fetch = routeFetch({})
    vi.stubGlobal('fetch', fetch)
    await getTrailBySlug('a b/c')
    expect(String(fetch.mock.calls[0][0])).toContain('slug=eq.a%20b%2Fc')
  })

  it('fetches only the baked trail_details columns, not select=*', async () => {
    const fetch = routeFetch({
      trails: [{ id: 't-uuid', slug: 'flowtrail', name: 'Flow', latitude: 50, longitude: 8 }],
    })
    vi.stubGlobal('fetch', fetch)
    await getTrailBySlug('flowtrail')

    const detailsUrl = fetch.mock.calls.map(c => String(c[0])).find(u => u.includes('/trail_details'))!
    expect(detailsUrl).not.toContain('select=*')
    // the fields bakedTrailDetails() reads must all be requested
    for (const col of ['rules', 'trail_description', 'status_hint', 'status_until', 'access_type', 'rain_closed_hours']) {
      expect(detailsUrl).toContain(col)
    }
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
