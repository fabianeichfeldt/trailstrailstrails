import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchAllSpots, buildSpotSnapshot } from './spotSnapshot'
import { getTrailBySlug } from './trails'

afterEach(() => vi.unstubAllGlobals())

const REST = 'http://localhost:54321/rest/v1'

// Behaves like PostgREST: honours eq filters, select columns and limit/offset paging.
function db(tables: Record<string, Record<string, unknown>[]>) {
  return vi.fn((url: string) => {
    const u = new URL(url)
    let rows = tables[u.pathname.split('/rest/v1/')[1]!] ?? []
    for (const [col, val] of u.searchParams) {
      if (val.startsWith('eq.')) rows = rows.filter(r => String(r[col]) === val.slice(3))
    }
    const offset = Number(u.searchParams.get('offset') ?? 0)
    const limit = u.searchParams.has('limit') ? Number(u.searchParams.get('limit')) : rows.length
    const select = u.searchParams.get('select') ?? '*'
    const pick = (r: Record<string, unknown>) => select === '*' ? r : Object.fromEntries(select.split(',').filter(c => c in r).map(c => [c, r[c]]))
    const page = rows.slice(offset, offset + limit).map(pick)
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(page) } as Response)
  })
}

function fixture(trailCount: number) {
  const trails = Array.from({ length: trailCount }, (_, i) => ({ id: `t${i}`, slug: `trail-${i}`, name: `Trail ${i}`, visible: 'true' }))
  return {
    trails: [...trails, { id: 'hidden', slug: 'versteckt', name: 'Hidden', visible: 'false' }],
    trail_details: trails.map(t => ({ trail_id: t.id, rules: ['Helm'], trail_description: `About ${t.name}` })),
    parks: [{ id: 'p1', slug: 'bikepark-x', name: 'Bikepark X' }],
    bike_park_details: [{ id: 'p1', opening_hours: '9-17' }],
    dirt_parks: [{ id: 'd1', slug: '', name: 'Pumptrack' }],
    dirt_park_details: [],
    trail_photos: [
      { trail_id: 't0', id: 'ph1', url: 'a.webp', copyright: null },
      { trail_id: 't0', id: 'ph2', url: 'b.webp', copyright: 'Max' },
      { trail_id: 'p1', id: 'ph3', url: 'c.webp', copyright: null },
    ],
  }
}

describe('fetchAllSpots', () => {
  it('makes the same number of requests for 3 spots as for 300', async () => {
    const small = db(fixture(3))
    await fetchAllSpots(REST, {}, small)
    const large = db(fixture(300))
    await fetchAllSpots(REST, {}, large)

    expect(large.mock.calls.length).toBe(small.mock.calls.length)
    expect(small.mock.calls.length).toBe(7) // 3 base + 3 details + photos
  })

  it('pages past PostgREST max-rows', async () => {
    const fetch = db(fixture(2500))
    const spots = await fetchAllSpots(REST, {}, fetch)

    expect(spots.filter(s => s.type === 'trail')).toHaveLength(2500)
    const trailPages = fetch.mock.calls.map(c => new URL(String(c[0]))).filter(u => u.pathname.endsWith('/trails'))
    expect(trailPages.map(u => u.searchParams.get('offset'))).toEqual(['0', '1000', '2000'])
  })

  it('merges each spot with its own details row and ordered photos, skipping hidden trails', async () => {
    const spots = await fetchAllSpots(REST, {}, db(fixture(2)))
    const byId = Object.fromEntries(spots.map(s => [s.id, s]))

    expect(byId.hidden).toBeUndefined()
    expect(byId.t0).toMatchObject({ type: 'trail', trail_description: 'About Trail 0', photos: [{ id: 'ph1' }, { id: 'ph2', copyright: 'Max' }] })
    expect(byId.t1).toMatchObject({ type: 'trail', trail_description: 'About Trail 1', photos: [] })
    expect(byId.p1).toMatchObject({ type: 'bikepark', opening_hours: '9-17', photos: [{ id: 'ph3', url: 'c.webp' }] })
    expect(byId.d1).toMatchObject({ type: 'dirtpark', photos: [] })
  })

  it('throws when a page fails, so the build never bakes a partial snapshot', async () => {
    const fetch = vi.fn((url: string) => Promise.resolve(
      url.includes('/parks?') ? { ok: false, status: 500 } as Response : { ok: true, status: 200, json: () => Promise.resolve([]) } as Response,
    ))
    await expect(fetchAllSpots(REST, {}, fetch)).rejects.toThrow(/parks/)
  })
})

describe('buildSpotSnapshot', () => {
  it('keys spots like the prerender routes: slug, else id', async () => {
    const snapshot = buildSpotSnapshot(await fetchAllSpots(REST, {}, db(fixture(1))))
    expect(Object.keys(snapshot).sort()).toEqual(['bikepark-x', 'd1', 'trail-0'])
  })

  it('bakes the same page payload the live resolver returns', async () => {
    const tables = {
      ...fixture(2),
      spot_slugs: [{ slug: 'trail-0', spot_id: 't0', spot_type: 'trail', is_current: 'true' }],
    }
    const snapshot = buildSpotSnapshot(await fetchAllSpots(REST, {}, db(tables)))
    vi.stubGlobal('fetch', db(tables))

    expect(snapshot['trail-0']).toEqual(await getTrailBySlug('trail-0'))
  })
})
