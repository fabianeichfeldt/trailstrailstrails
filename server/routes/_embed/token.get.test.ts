import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { SPOT_TYPE_LIST } from '@@/app/types/SpotTypes'

const json = (body: unknown, ok = true) => ({ ok, json: async () => body })

function stubH3(opts: { token?: string; origin?: string; referer?: string; parentHost?: string }) {
  const headers: Record<string, string | undefined> = { origin: opts.origin, referer: opts.referer }
  const out: Record<string, string> = {}
  vi.stubGlobal('defineEventHandler', (h: any) => h)
  vi.stubGlobal('getRouterParam', () => opts.token)
  vi.stubGlobal('getRequestHeader', (_e: any, n: string) => headers[n])
  vi.stubGlobal('getQuery', () => (opts.parentHost ? { parentHost: opts.parentHost } : {}))
  vi.stubGlobal('setResponseHeader', (_e: any, n: string, v: string) => { out[n] = v })
  vi.stubGlobal('createError', (o: any) => Object.assign(new Error(o.statusMessage ?? 'err'), o))
  return out
}

async function handler() {
  vi.resetModules()
  return (await import('./[token].get')).default as (e: any) => Promise<any>
}

const tokenRow = (over: Record<string, unknown> = {}) =>
  ({ id: 'tok-id', allowed_hosts: ['example.com'], is_active: true, is_wildcard: false, ...over })

beforeEach(() => {
  process.env.NUXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
  process.env.NUXT_PUBLIC_SUPABASE_KEY = 'k'
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('_embed/[token] route', () => {
  test('400 when token missing', async () => {
    stubH3({})
    await expect((await handler())({})).rejects.toMatchObject({ statusCode: 400 })
  })

  test('400 when supabase env missing', async () => {
    stubH3({ token: 't' })
    delete process.env.NUXT_PUBLIC_SUPABASE_URL
    delete process.env.VITE_SUPABASE_URL
    await expect((await handler())({})).rejects.toMatchObject({ statusCode: 400 })
  })

  test('502 when token lookup fails', async () => {
    stubH3({ token: 't', origin: 'https://example.com' })
    vi.stubGlobal('fetch', vi.fn(async () => json([], false)))
    await expect((await handler())({})).rejects.toMatchObject({ statusCode: 502 })
  })

  test('403 TOKEN_NOT_FOUND / TOKEN_INACTIVE / HOST_NOT_ALLOWED', async () => {
    stubH3({ token: 't', origin: 'https://evil.com' })
    const h = await handler()
    vi.stubGlobal('fetch', vi.fn(async () => json([])))
    await expect(h({})).rejects.toMatchObject({ statusCode: 403, statusMessage: 'TOKEN_NOT_FOUND' })
    vi.stubGlobal('fetch', vi.fn(async () => json([tokenRow({ is_active: false })])))
    await expect(h({})).rejects.toMatchObject({ statusCode: 403, statusMessage: 'TOKEN_INACTIVE' })
    vi.stubGlobal('fetch', vi.fn(async () => json([tokenRow()])))
    await expect(h({})).rejects.toMatchObject({ statusCode: 403, statusMessage: 'HOST_NOT_ALLOWED' })
  })

  test('encodes token and sends apikey headers; parentHost query authorises', async () => {
    stubH3({ token: 'a b/c', parentHost: 'example.com' })
    const f = vi.fn(async () => json([]))
    vi.stubGlobal('fetch', f)
    await expect((await handler())({})).rejects.toMatchObject({ statusMessage: 'TOKEN_NOT_FOUND' })
    const [url, init] = f.mock.calls[0] as any
    expect(url).toContain('embed_tokens?token=eq.a%20b%2Fc&select=id,allowed_hosts,is_active,is_wildcard&limit=1')
    expect(init.headers).toEqual({ apikey: 'k', Authorization: 'Bearer k' })
  })

  test('specific token with no linked trails returns [] with CORS header', async () => {
    const out = stubH3({ token: 't', origin: 'https://example.com' })
    vi.stubGlobal('fetch', vi.fn(async (u: string) =>
      u.includes('embed_tokens') ? json([tokenRow()]) : json([])))
    expect(await (await handler())({})).toEqual([])
    expect(out['Access-Control-Allow-Origin']).toBe('https://example.com')
  })

  test('502 when embed_token_trails fails', async () => {
    stubH3({ token: 't', origin: 'https://example.com' })
    vi.stubGlobal('fetch', vi.fn(async (u: string) =>
      u.includes('embed_tokens') ? json([tokenRow()]) : json([], false)))
    await expect((await handler())({})).rejects.toMatchObject({ statusCode: 502 })
  })

  test('specific token joins spots with gpx trails, tours and parking by type table', async () => {
    const out = stubH3({ token: 't', origin: 'https://example.com' })
    const trailTable = SPOT_TYPE_LIST.find(d => d.type === 'trail')!.table
    const f = vi.fn(async (u: string) => {
      if (u.includes('embed_tokens')) return json([tokenRow()])
      if (u.includes('embed_token_trails')) return json([
        { trail_id: 's1', trail_type: 'trail' }, { trail_id: 's2', trail_type: 'trail' }, { trail_id: 'x', trail_type: 'bogus' },
      ])
      if (u.includes(`/${trailTable}?`)) return json([
        { id: 's1', name: 'One', latitude: 1, longitude: 2, approved: true },
        { id: 's2', name: 'Two', latitude: 3, longitude: 4 },
      ])
      if (u.includes('spot_gpx_trails')) return json([{ spot_id: 's1', name: 'T', difficulty: 'blue', gpx_points: [[1, 2, 3]] }])
      if (u.includes('spot_gpx_tours')) return json([{ spot_id: 's1', name: 'Tour', gpx_points: [[4, 5, 6]] }])
      if (u.includes('parking')) return json([{ id: 'p', spot_id: 's2', name: 'P', lat: 9, lng: 8 }])
      return json([], false)
    })
    vi.stubGlobal('fetch', f)
    const res = await (await handler())({})
    expect(res).toEqual([
      { id: 's1', name: 'One', latitude: 1, longitude: 2, type: 'trail', approved: true,
        gpx_trails: [{ name: 'T', difficulty: 'blue', gpx_points: [[1, 2, 3]] }],
        gpx_tours: [{ name: 'Tour', gpx_points: [[4, 5, 6]] }], parking: [] },
      { id: 's2', name: 'Two', latitude: 3, longitude: 4, type: 'trail', approved: undefined,
        gpx_trails: [], gpx_tours: [], parking: [{ id: 'p', name: 'P', lat: 9, lng: 8 }] },
    ])
    const urls = f.mock.calls.map(c => c[0] as string)
    expect(urls.some(u => u.includes(`${trailTable}?id=in.(s1,s2)&select=id,name,latitude,longitude,approved`))).toBe(true)
    expect(urls.some(u => u.includes('spot_id=in.(s1,s2,x)'))).toBe(true)
    expect(out['Access-Control-Allow-Origin']).toBe('https://example.com')
  })

  test('failed gpx/parking responses degrade to empty lists', async () => {
    stubH3({ token: 't', origin: 'https://example.com' })
    const trailTable = SPOT_TYPE_LIST.find(d => d.type === 'trail')!.table
    vi.stubGlobal('fetch', vi.fn(async (u: string) => {
      if (u.includes('embed_tokens')) return json([tokenRow()])
      if (u.includes('embed_token_trails')) return json([{ trail_id: 's1', trail_type: 'trail' }])
      if (u.includes(`/${trailTable}?`)) return json([{ id: 's1', name: 'One', latitude: 1, longitude: 2 }])
      return json([], false)
    }))
    const res = await (await handler())({})
    expect(res[0]).toMatchObject({ gpx_trails: [], gpx_tours: [], parking: [] })
  })

  test('wildcard token fetches every spot type, tags them, skips failed tables; CORS falls back to *', async () => {
    const out = stubH3({ token: 't', parentHost: 'example.com' })
    const [first, second] = SPOT_TYPE_LIST
    const f = vi.fn(async (u: string) => {
      if (u.includes('embed_tokens')) return json([tokenRow({ is_wildcard: true })])
      if (u.includes(`/${first!.table}?`)) return json([{ id: 'a', name: 'A', latitude: 1, longitude: 2 }])
      if (u.includes(`/${second!.table}?`)) return json([], false)
      return json([], true)
    })
    vi.stubGlobal('fetch', f)
    const res = await (await handler())({})
    expect(res[0]).toMatchObject({ id: 'a', type: first!.type })
    expect(res).toHaveLength(1)
    const urls = f.mock.calls.map(c => c[0] as string)
    expect(urls.some(u => u.includes(`${first!.table}?select=id,name,latitude,longitude,approved&limit=1000`))).toBe(true)
    expect(urls.some(u => u.includes('spot_gpx_trails?select=spot_id,name,difficulty,gpx_points&limit=5000'))).toBe(true)
    expect(urls.some(u => u.includes('parking?select=id,spot_id,name,lat,lng&limit=2000'))).toBe(true)
    expect(urls.some(u => u.includes('embed_token_trails'))).toBe(false)
    expect(out['Access-Control-Allow-Origin']).toBe('*')
  })
})
