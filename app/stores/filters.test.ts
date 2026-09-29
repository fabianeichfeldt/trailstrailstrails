import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useFiltersStore } from './filters'

const KEY = 'map-grayscale'

describe('filtersStore.grayscaleMap', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to on', () => {
    expect(useFiltersStore().grayscaleMap).toBe(true)
  })

  it('restores a stored "off" preference', () => {
    localStorage.setItem(KEY, '0')
    expect(useFiltersStore().grayscaleMap).toBe(false)
  })

  it('persists toggles so the choice survives a reload', async () => {
    const store = useFiltersStore()
    store.grayscaleMap = false
    await nextTick()
    expect(localStorage.getItem(KEY)).toBe('0')

    setActivePinia(createPinia())
    expect(useFiltersStore().grayscaleMap).toBe(false)
  })

  it('falls back to the default when storage throws', () => {
    const orig = Storage.prototype.getItem
    Storage.prototype.getItem = () => { throw new Error('blocked') }
    try {
      expect(useFiltersStore().grayscaleMap).toBe(true)
    } finally {
      Storage.prototype.getItem = orig
    }
  })
})
