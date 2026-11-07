import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMapStore } from './map'

describe('mapStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with no active trail, a closed panel and no overlays open', () => {
    const store = useMapStore()
    expect(store.activeTrailId).toBeNull()
    expect(store.panelOpen).toBe(false)
    expect(store.userLocation).toBeNull()
    expect(store.authModalOpen).toBe(false)
    expect(store.drawerOpen).toBe(false)
    expect(store.reportModalOpen).toBe(false)
    expect(store.reportModalTrailId).toBeNull()
    expect(store.reportModalTrailName).toBeNull()
  })

  it('openTrail selects the trail and opens the panel', () => {
    const store = useMapStore()
    store.openTrail('trail-7')
    expect(store.activeTrailId).toBe('trail-7')
    expect(store.panelOpen).toBe(true)
  })

  it('closePanel clears the selection and closes the panel', () => {
    const store = useMapStore()
    store.openTrail('trail-7')
    store.closePanel()
    expect(store.activeTrailId).toBeNull()
    expect(store.panelOpen).toBe(false)
  })

  it('keeps overlay state independent of the trail panel', () => {
    const store = useMapStore()
    store.authModalOpen = true
    store.openTrail('t')
    store.closePanel()
    expect(store.authModalOpen).toBe(true)
  })
})
