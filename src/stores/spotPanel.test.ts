import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mocked at the module boundary — never hit a real Supabase URL in tests
// (CLAUDE.md's test mandate). fetchMultipleSpotParking is the only
// communication/trails.ts export this store's Phase-1 action touches.
vi.mock('~/communication/trails', () => ({
  fetchMultipleSpotParking: vi.fn(),
}))

import { fetchMultipleSpotParking, type SpotParkingLot } from '~/communication/trails'
import { useSpotPanelStore } from './spotPanel'
import type { Trail } from '~/types/Trail'

function trail(id: string): Trail {
  return { id, name: 'Testspot', type: 'trail', latitude: 1, longitude: 1, approved: true } as Trail
}

describe('useSpotPanelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchMultipleSpotParking).mockReset()
  })

  it('starts with empty/closed defaults', () => {
    const store = useSpotPanelStore()
    expect(store.currentItem).toBeNull()
    expect(store.isOpen).toBe(false)
    expect(store.parkingLots).toEqual([])
    expect(store.highlightedParkingLotId).toBeNull()
    expect(store.parkingTabForceVisible).toBe(false)
  })

  it('loadParking fetches lots for the given spot and stores them', async () => {
    const store = useSpotPanelStore()
    store.currentItem = trail('s1')
    const lots: SpotParkingLot[] = [{ id: 'p1', name: 'Lot A', lat: 1, lng: 1, info: ['Kostenlos'] }]
    vi.mocked(fetchMultipleSpotParking).mockResolvedValue(new Map([['s1', lots]]))

    await store.loadParking('s1')

    expect(fetchMultipleSpotParking).toHaveBeenCalledWith(['s1'])
    expect(store.parkingLots).toEqual(lots)
  })

  it('stores an empty list when the spot has no parking lots', async () => {
    const store = useSpotPanelStore()
    store.currentItem = trail('s1')
    vi.mocked(fetchMultipleSpotParking).mockResolvedValue(new Map())

    await store.loadParking('s1')

    expect(store.parkingLots).toEqual([])
  })

  it('bails out without overwriting state if the panel moved to a different spot while the fetch was in flight', async () => {
    const store = useSpotPanelStore()
    store.currentItem = trail('s1')
    let resolveFetch!: (value: Map<string, SpotParkingLot[]>) => void
    vi.mocked(fetchMultipleSpotParking).mockReturnValue(
      new Promise(resolve => { resolveFetch = resolve }),
    )

    const pending = store.loadParking('s1')
    // Panel moved on to a different spot before the fetch resolved.
    store.currentItem = trail('s2')
    store.parkingLots = [{ id: 'stale-guard', name: 'should not be overwritten', lat: 0, lng: 0 }]

    resolveFetch(new Map([['s1', [{ id: 'p1', name: 'Lot A', lat: 1, lng: 1 }]]]))
    await pending

    expect(store.parkingLots).toEqual([{ id: 'stale-guard', name: 'should not be overwritten', lat: 0, lng: 0 }])
  })

  it('bails out without overwriting state if the panel closed while the fetch was in flight', async () => {
    const store = useSpotPanelStore()
    store.currentItem = trail('s1')
    let resolveFetch!: (value: Map<string, SpotParkingLot[]>) => void
    vi.mocked(fetchMultipleSpotParking).mockReturnValue(
      new Promise(resolve => { resolveFetch = resolve }),
    )

    const pending = store.loadParking('s1')
    store.currentItem = null
    store.isOpen = false

    resolveFetch(new Map([['s1', [{ id: 'p1', name: 'Lot A', lat: 1, lng: 1 }]]]))
    await pending

    expect(store.parkingLots).toEqual([])
  })

  it('logs and leaves parkingLots untouched when the fetch rejects', async () => {
    const store = useSpotPanelStore()
    store.currentItem = trail('s1')
    store.parkingLots = [{ id: 'existing', name: 'Existing Lot', lat: 0, lng: 0 }]
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(fetchMultipleSpotParking).mockRejectedValue(new Error('network error'))

    await store.loadParking('s1')

    expect(store.parkingLots).toEqual([{ id: 'existing', name: 'Existing Lot', lat: 0, lng: 0 }])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
