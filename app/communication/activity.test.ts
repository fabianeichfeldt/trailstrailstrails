import { describe, it, expect, vi, afterEach } from 'vitest'
import { getRecentActivity } from './activity'

const BASE_URL = 'https://test.supabase.co'

function json(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
}

function err(status: number) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve([]) })
}

afterEach(() => vi.unstubAllGlobals())

function mockFetch(byTable: Record<string, unknown[]>) {
  const fetch = vi.fn((url: string, _init?: RequestInit) => {
    const table = new URL(url).pathname.split('/').pop()!.split('?')[0]
    return table in byTable ? json(byTable[table]) : json([])
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('getRecentActivity — HTTP mechanics', () => {
  it('queries trails, parks, dirt_parks, trail_photos, spot_gpx_trails, spot_gpx_tours', async () => {
    const fetch = mockFetch({})
    await getRecentActivity()
    const tables = fetch.mock.calls.map(([url]) => new URL(url as string).pathname.split('/').pop()!.split('?')[0])
    expect(tables).toEqual(
      expect.arrayContaining(['trails', 'parks', 'dirt_parks', 'trail_photos', 'spot_gpx_trails', 'spot_gpx_tours']),
    )
  })

  it('calls REST endpoints with the anon key', async () => {
    const fetch = mockFetch({})
    await getRecentActivity()
    for (const call of fetch.mock.calls) {
      expect((call[0] as string)).toMatch(new RegExp(`^${BASE_URL}/rest/v1/`))
      expect((call[1] as RequestInit).headers).toMatchObject({ apikey: expect.any(String) })
    }
  })

  it('only requests approved spots', async () => {
    const fetch = mockFetch({})
    await getRecentActivity()
    const spotCalls = fetch.mock.calls.filter(([url]) => /\/(trails|parks|dirt_parks)\?/.test(url as string))
    expect(spotCalls.length).toBe(3)
    for (const [url] of spotCalls) expect(url).toContain('approved=eq.true')
  })

  it('returns an empty array when a request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(500)))
    await expect(getRecentActivity()).resolves.toEqual([])
  })
})

describe('getRecentActivity — item mapping', () => {
  it('maps new trails/parks/dirt_parks to type "spot"', async () => {
    mockFetch({
      trails: [{ id: 't1', name: 'Flowtrail Süd', created_at: '2026-01-03T00:00:00Z' }],
      parks: [{ id: 'p1', name: 'Bikepark Nord', created_at: '2026-01-02T00:00:00Z' }],
      dirt_parks: [{ id: 'd1', name: 'Pumptrack West', created_at: '2026-01-01T00:00:00Z' }],
    })
    const result = await getRecentActivity()
    expect(result).toEqual([
      { type: 'spot', trailId: 't1', name: 'Flowtrail Süd', created_at: '2026-01-03T00:00:00Z' },
      { type: 'spot', trailId: 'p1', name: 'Bikepark Nord', created_at: '2026-01-02T00:00:00Z' },
      { type: 'spot', trailId: 'd1', name: 'Pumptrack West', created_at: '2026-01-01T00:00:00Z' },
    ])
  })

  it('maps trail_photos to type "photo" using the linked trail', async () => {
    mockFetch({
      trail_photos: [
        { id: 'ph1', created_at: '2026-01-05T00:00:00Z', trails: { id: 't1', name: 'Flowtrail Süd', approved: true } },
      ],
    })
    const result = await getRecentActivity()
    expect(result).toEqual([{ type: 'photo', trailId: 't1', name: 'Flowtrail Süd', created_at: '2026-01-05T00:00:00Z' }])
  })

  it('excludes photos whose linked trail is not approved', async () => {
    mockFetch({
      trail_photos: [
        { id: 'ph1', created_at: '2026-01-05T00:00:00Z', trails: { id: 't1', name: 'Unapproved', approved: false } },
      ],
    })
    expect(await getRecentActivity()).toEqual([])
  })

  it('excludes photos with no linked trail', async () => {
    mockFetch({ trail_photos: [{ id: 'ph1', created_at: '2026-01-05T00:00:00Z', trails: null }] })
    expect(await getRecentActivity()).toEqual([])
  })

  it('maps spot_gpx_trails and spot_gpx_tours to type "gpx"', async () => {
    mockFetch({
      spot_gpx_trails: [
        { id: 'g1', created_at: '2026-01-06T00:00:00Z', trails: { id: 't1', name: 'Flowtrail Süd', approved: true } },
      ],
      spot_gpx_tours: [
        { id: 'g2', created_at: '2026-01-07T00:00:00Z', trails: { id: 't2', name: 'Enduro Runde', approved: true } },
      ],
    })
    const result = await getRecentActivity()
    expect(result).toEqual([
      { type: 'gpx', trailId: 't2', name: 'Enduro Runde', created_at: '2026-01-07T00:00:00Z' },
      { type: 'gpx', trailId: 't1', name: 'Flowtrail Süd', created_at: '2026-01-06T00:00:00Z' },
    ])
  })
})

describe('getRecentActivity — sorting, dedupe, limit', () => {
  it('sorts all items by created_at descending', async () => {
    mockFetch({
      trails: [{ id: 't1', name: 'Old', created_at: '2026-01-01T00:00:00Z' }],
      parks: [{ id: 'p1', name: 'New', created_at: '2026-01-10T00:00:00Z' }],
    })
    const result = await getRecentActivity()
    expect(result.map(i => i.trailId)).toEqual(['p1', 't1'])
  })

  it('dedupes same type+trailId, keeping only the most recent occurrence', async () => {
    mockFetch({
      trail_photos: [
        { id: 'ph1', created_at: '2026-01-05T00:00:00Z', trails: { id: 't1', name: 'Flowtrail Süd', approved: true } },
        { id: 'ph2', created_at: '2026-01-08T00:00:00Z', trails: { id: 't1', name: 'Flowtrail Süd', approved: true } },
      ],
    })
    const result = await getRecentActivity()
    expect(result).toEqual([{ type: 'photo', trailId: 't1', name: 'Flowtrail Süd', created_at: '2026-01-08T00:00:00Z' }])
  })

  it('keeps distinct types for the same trailId', async () => {
    mockFetch({
      trails: [{ id: 't1', name: 'Flowtrail Süd', created_at: '2026-01-01T00:00:00Z' }],
      trail_photos: [
        { id: 'ph1', created_at: '2026-01-05T00:00:00Z', trails: { id: 't1', name: 'Flowtrail Süd', approved: true } },
      ],
    })
    const result = await getRecentActivity()
    expect(result).toEqual([
      { type: 'photo', trailId: 't1', name: 'Flowtrail Süd', created_at: '2026-01-05T00:00:00Z' },
      { type: 'spot', trailId: 't1', name: 'Flowtrail Süd', created_at: '2026-01-01T00:00:00Z' },
    ])
  })

  it('returns at most 8 items', async () => {
    const trails = Array.from({ length: 12 }, (_, i) => ({
      id: `t${i}`,
      name: `Trail ${i}`,
      created_at: new Date(2026, 0, i + 1).toISOString(),
    }))
    mockFetch({ trails })
    const result = await getRecentActivity()
    expect(result.length).toBe(8)
  })
})
