import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTrailsStore } from '~/stores/trails'

const SUPABASE_URL = 'http://localhost:54321'

const DB_TRAILS = [
  { id: 't1', slug: 't1', name: 'Flowtrail Tegernsee', latitude: 47.71, longitude: 11.76, approved: true, visible: true },
  { id: 't2', slug: 't2', name: 'Versteckter Trail', latitude: 48.76, longitude: 11.42, approved: true, visible: false },
]

// Mocks the network boundary like PostgREST would: `visible=eq.true` filters rows.
function mockNetwork() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo) => {
    const url = new URL(typeof input === 'string' ? input : (input as Request).url)
    let rows: Record<string, unknown>[] = []
    if (url.pathname.endsWith('/rest/v1/trails')) rows = DB_TRAILS
    if (url.searchParams.get('visible') === 'eq.true') rows = rows.filter(r => r.visible === true)
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
}

vi.stubGlobal('useSupabaseClient', () => ({}))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { supabase: { url: SUPABASE_URL, key: 'test-anon-key' } } }))

beforeEach(() => {
  setActivePinia(createPinia())
  mockNetwork()
})

describe('trails store', () => {
  it('does not put hidden trails (visible = false) on the map', async () => {
    const store = useTrailsStore()
    await store.fetchAll()

    expect(store.all.map(t => t.id)).toEqual(['t1'])
  })
})
