import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)

const HIDDEN = { id: 'h1', slug: 'versteckt', name: 'Versteckter Trail', latitude: 48, longitude: 11, approved: true, visible: false }
const SHOWN = { id: 't1', slug: 'flow', name: 'Flowtrail', latitude: 47, longitude: 11, approved: true, visible: true }

beforeEach(() => {
  process.env.NUXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
  process.env.NUXT_PUBLIC_SUPABASE_KEY = 'test-anon-key'
  // Behaves like PostgREST: `visible=eq.true` drops the hidden row.
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = new URL(url)
    let rows: Record<string, unknown>[] = u.pathname.endsWith('/trails') ? [SHOWN, HIDDEN] : []
    if (u.searchParams.get('visible') === 'eq.true') rows = rows.filter(r => r.visible === true)
    return new Response(JSON.stringify(rows), { status: 200 })
  }))
})

describe('server/api/trails', () => {
  it('leaves hidden trails (visible = false) out', async () => {
    const handler = (await import('./trails.get')).default as unknown as () => Promise<Array<{ id: string }>>
    expect((await handler()).map(t => t.id)).toEqual(['t1'])
  })
})
