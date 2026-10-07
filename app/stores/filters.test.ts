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

describe('filtersStore.soilMatch', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('matches a level inside the range and ghosts one outside', () => {
    const { soilMatch } = useFiltersStore()
    expect(soilMatch('prime', { lo: 1, hi: 3 })).toBe('match')
    expect(soilMatch('dusty', { lo: 1, hi: 3 })).toBe('ghost')
    expect(soilMatch('wet', { lo: 1, hi: 3 })).toBe('ghost')
  })

  it('is inclusive at both edges', () => {
    const { soilMatch } = useFiltersStore()
    expect(soilMatch('dry', { lo: 1, hi: 3 })).toBe('match')
    expect(soilMatch('damp', { lo: 1, hi: 3 })).toBe('match')
  })

  it('treats raining as 3 and snow as 4', () => {
    const { soilMatch } = useFiltersStore()
    expect(soilMatch('raining', { lo: 3, hi: 3 })).toBe('match')
    expect(soilMatch('raining', { lo: 0, hi: 2 })).toBe('ghost')
    expect(soilMatch('snow', { lo: 4, hi: 4 })).toBe('match')
    expect(soilMatch('snow', { lo: 0, hi: 3 })).toBe('ghost')
  })

  it('returns none for a missing, unknown or hard verdict, whatever the range', () => {
    const { soilMatch } = useFiltersStore()
    expect(soilMatch(undefined, { lo: 0, hi: 4 })).toBe('none')
    expect(soilMatch('unknown', { lo: 1, hi: 2 })).toBe('none')
    expect(soilMatch('hard', { lo: 0, hi: 4 })).toBe('none')
  })

  it('works with float handle positions', () => {
    const { soilMatch } = useFiltersStore()
    expect(soilMatch('prime', { lo: 2.2, hi: 4 })).toBe('ghost')
    expect(soilMatch('prime', { lo: 1.4, hi: 2.6 })).toBe('match')
  })
})
