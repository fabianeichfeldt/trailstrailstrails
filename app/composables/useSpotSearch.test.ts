import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useSpotSearch } from './useSpotSearch'

// The composable reads the spot lists through the trails store (a Nuxt
// auto-import) and the geocoder through communication/places.ts. The store is
// faked here — the real one needs a live Supabase client; the geocoder is
// exercised for real with only `fetch` mocked, so the DACH/worldwide logic
// stays covered end-to-end from the searchbar's point of view.

interface FakeSpot { id: string; name: string; type: string }

let ensureLoaded: ReturnType<typeof vi.fn>
let store: {
  trails: FakeSpot[]
  bikeparks: FakeSpot[]
  dirtparks: FakeSpot[]
  ensureLoaded: typeof ensureLoaded
}

function setStore(spots: Partial<Record<'trails' | 'bikeparks' | 'dirtparks', FakeSpot[]>>) {
  store.trails = spots.trails ?? []
  store.bikeparks = spots.bikeparks ?? []
  store.dirtparks = spots.dirtparks ?? []
}

/** Nominatim answers with `places` (empty by default → no "Orte" group). */
function mockPlaces(places: unknown[] = []) {
  const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => places })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

beforeEach(() => {
  ensureLoaded = vi.fn().mockResolvedValue(undefined)
  store = { trails: [], bikeparks: [], dirtparks: [], ensureLoaded }
  vi.stubGlobal('useTrailsStore', () => store)
  mockPlaces()
})

// NB: deliberately no vi.unstubAllGlobals() — it would also drop the stubs
// vitest.setup.ts installs process-wide to stand in for Nuxt's auto-imports.
// Every global this file stubs is re-stubbed in beforeEach instead.
afterEach(() => {
  vi.useRealTimers()
})

function names(search: ReturnType<typeof useSpotSearch>) {
  return search.flatResults.value.map(i => i.name)
}

describe('useSpotSearch — spot scoring', () => {
  it('orders exact match before prefix match before substring match, and drops non-matches', async () => {
    setStore({
      trails: [
        { id: '3', name: 'Superflow Nord', type: 'trail' },   // substring → 60
        { id: '1', name: 'Flow', type: 'trail' },             // exact     → 100
        { id: '2', name: 'Flowtrail Tegernsee', type: 'trail' }, // prefix  → 80
        { id: '4', name: 'Waldpfad', type: 'trail' },         // no match  → dropped
      ],
    })
    const search = useSpotSearch()

    await search.runSearch('Flow')

    expect(names(search)).toEqual(['Flow', 'Flowtrail Tegernsee', 'Superflow Nord'])
  })

  it('matches case-insensitively', async () => {
    setStore({ trails: [{ id: '1', name: 'Flowtrail Tegernsee', type: 'trail' }] })
    const search = useSpotSearch()

    await search.runSearch('fLoWtRaIl')

    expect(names(search)).toEqual(['Flowtrail Tegernsee'])
  })

  it('matches a word in the middle of a name', async () => {
    setStore({ trails: [{ id: '1', name: 'Alter Waldpfad Ingolstadt', type: 'trail' }] })
    const search = useSpotSearch()

    await search.runSearch('Ingol')

    expect(names(search)).toEqual(['Alter Waldpfad Ingolstadt'])
  })

  it('caps the spot group at 5 results', async () => {
    setStore({
      trails: Array.from({ length: 9 }, (_, i) => ({ id: `t${i}`, name: `Flowtrail ${i}`, type: 'trail' })),
    })
    const search = useSpotSearch()

    await search.runSearch('Flow')

    expect(search.results.value).toHaveLength(1)
    expect(search.results.value[0].items).toHaveLength(5)
  })
})

describe('useSpotSearch — group assembly', () => {
  it('labels and icons every spot type, all under one "Trails & Parks" group', async () => {
    setStore({
      trails: [{ id: 't1', name: 'Testspot Trail', type: 'trail' }],
      bikeparks: [{ id: 'b1', name: 'Testspot Bikepark', type: 'bikepark' }],
      dirtparks: [{ id: 'd1', name: 'Testspot Pumptrack', type: 'dirtpark' }],
    })
    const search = useSpotSearch()

    await search.runSearch('Testspot')

    expect(search.results.value).toHaveLength(1)
    expect(search.results.value[0].label).toBe('Trails & Parks')
    expect(search.results.value[0].items.map(i => [i.name, i.sub, i.icon, i.trailId])).toEqual([
      ['Testspot Trail', 'Trail', '🚵️', 't1'],
      ['Testspot Bikepark', 'Bikepark', '🚵', 'b1'],
      ['Testspot Pumptrack', 'Dirtpark / Pumptrack', '🚵', 'd1'],
    ])
  })

  it('appends geocoder hits as a second "Orte & Regionen" group with parsed coordinates', async () => {
    setStore({ trails: [{ id: 't1', name: 'Freiburg Flowtrail', type: 'trail' }] })
    mockPlaces([{ display_name: 'Freiburg, Breisgau, Baden-Württemberg, Deutschland', lat: '47.99', lon: '7.84' }])
    const search = useSpotSearch()

    await search.runSearch('Freiburg')

    expect(search.results.value.map(g => g.label)).toEqual(['Trails & Parks', 'Orte & Regionen'])
    expect(search.results.value[1].items[0]).toEqual({
      key: 'place-0',
      icon: '📍',
      name: 'Freiburg',
      sub: 'Breisgau, Baden-Württemberg',
      lat: 47.99,
      lon: 7.84,
    })
  })

  it('flags "no results" only when neither source matched', async () => {
    const search = useSpotSearch()

    await search.runSearch('gibtesnicht')

    expect(search.results.value).toEqual([])
    expect(search.noResults.value).toBe(true)
  })

  it('does not flag "no results" when spots matched but the geocoder found nothing', async () => {
    setStore({ trails: [{ id: 't1', name: 'Flowtrail Tegernsee', type: 'trail' }] })
    const search = useSpotSearch()

    await search.runSearch('Flow')

    expect(search.noResults.value).toBe(false)
  })
})

describe('useSpotSearch — lazy spot loading', () => {
  it('awaits ensureLoaded() before scoring, so spots that arrive late still match', async () => {
    let releaseStore!: () => void
    store.ensureLoaded = vi.fn(() => new Promise<void>((resolve) => {
      releaseStore = () => {
        setStore({ trails: [{ id: 't1', name: 'Flowtrail Tegernsee', type: 'trail' }] })
        resolve()
      }
    }))
    const search = useSpotSearch()

    const done = search.runSearch('Flow')
    await flushPromises()
    // Nothing scored yet — the store had not answered.
    expect(search.results.value).toEqual([])

    releaseStore()
    await done

    expect(names(search)).toEqual(['Flowtrail Tegernsee'])
  })

  it('focusing the input triggers the lazy load', () => {
    const search = useSpotSearch()

    search.onFocus()

    expect(store.ensureLoaded).toHaveBeenCalledTimes(1)
  })
})

describe('useSpotSearch — debounce and short queries', () => {
  it('produces no results for a query shorter than 2 characters', async () => {
    vi.useFakeTimers()
    setStore({ trails: [{ id: 't1', name: 'Flowtrail Tegernsee', type: 'trail' }] })
    const search = useSpotSearch()

    search.query.value = 'F'
    search.onInput()
    await vi.advanceTimersByTimeAsync(1000)

    expect(search.results.value).toEqual([])
    expect(search.noResults.value).toBe(false)
    expect(store.ensureLoaded).not.toHaveBeenCalled()
  })

  it('searches once, 250 ms after the last keystroke', async () => {
    vi.useFakeTimers()
    setStore({ trails: [{ id: 't1', name: 'Flowtrail Tegernsee', type: 'trail' }] })
    const fetch = mockPlaces()
    const search = useSpotSearch()

    search.query.value = 'Fl'
    search.onInput()
    await vi.advanceTimersByTimeAsync(200)
    search.query.value = 'Flow'
    search.onInput()
    await vi.advanceTimersByTimeAsync(100)

    expect(search.results.value).toEqual([])

    await vi.advanceTimersByTimeAsync(200)

    expect(names(search)).toEqual(['Flowtrail Tegernsee'])
    // One debounced search → one DACH geocoder request (which found nothing,
    // hence the worldwide retry), not one per keystroke.
    expect(fetch.mock.calls.map(c => c[0] as string).filter(u => u.includes('q=Fl&'))).toHaveLength(0)
  })
})

describe('useSpotSearch — stale response guard', () => {
  it('a slow geocoder answer for an abandoned query never overwrites newer results', async () => {
    setStore({
      trails: [
        { id: 't1', name: 'Flowtrail Tegernsee', type: 'trail' },
        { id: 't2', name: 'Waldpfad Ingolstadt', type: 'trail' },
      ],
    })

    let releaseSlow!: (places: unknown[]) => void
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('q=Flow')) {
        return new Promise(resolve => {
          releaseSlow = (places) => resolve({ ok: true, status: 200, json: async () => places })
        })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] })
    }))

    const search = useSpotSearch()

    const abandoned = search.runSearch('Flow')
    await flushPromises()
    const current = search.runSearch('Waldpfad')
    await current

    expect(names(search)).toEqual(['Waldpfad Ingolstadt'])

    // The abandoned query's geocoder answer lands after the user moved on.
    releaseSlow([{ display_name: 'Flowtown, Deutschland', lat: '1', lon: '2' }])
    await abandoned

    expect(names(search)).toEqual(['Waldpfad Ingolstadt'])
    expect(search.results.value.map(g => g.label)).toEqual(['Trails & Parks'])
  })
})

describe('useSpotSearch — selection and clearing', () => {
  beforeEach(() => {
    setStore({
      trails: [
        { id: 't1', name: 'Flowtrail Tegernsee', type: 'trail' },
        { id: 't2', name: 'Flowtrail Nord', type: 'trail' },
      ],
    })
  })

  it('cycles the highlight down and wraps around', async () => {
    const search = useSpotSearch()
    await search.runSearch('Flowtrail')

    expect(search.highlightedItem.value).toBeUndefined()
    search.highlightNext()
    expect(search.highlightedItem.value?.name).toBe('Flowtrail Tegernsee')
    search.highlightNext()
    expect(search.highlightedItem.value?.name).toBe('Flowtrail Nord')
    search.highlightNext()
    expect(search.highlightedItem.value?.name).toBe('Flowtrail Tegernsee')
  })

  it('cycles the highlight up from nothing to the last item', async () => {
    const search = useSpotSearch()
    await search.runSearch('Flowtrail')

    search.highlightPrev()
    expect(search.highlightedItem.value?.name).toBe('Flowtrail Nord')
  })

  it('resets the highlight whenever the result set changes', async () => {
    const search = useSpotSearch()
    await search.runSearch('Flowtrail')
    search.highlightNext()

    await search.runSearch('Nord')

    expect(search.selectedIndex.value).toBe(-1)
  })

  it('clear() empties query and results', async () => {
    const search = useSpotSearch()
    search.query.value = 'Flowtrail'
    await search.runSearch('Flowtrail')

    search.clear()

    expect(search.query.value).toBe('')
    expect(search.results.value).toEqual([])
    expect(search.noResults.value).toBe(false)
  })

  it('clearResults() closes the dropdown but keeps the typed query', async () => {
    const search = useSpotSearch()
    search.query.value = 'Flowtrail'
    await search.runSearch('Flowtrail')

    search.clearResults()

    expect(search.query.value).toBe('Flowtrail')
    expect(search.results.value).toEqual([])
  })
})
