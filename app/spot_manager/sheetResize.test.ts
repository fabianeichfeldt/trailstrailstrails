import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  clampSheetHeightVh,
  getStoredSheetHeightVh,
  setStoredSheetHeightVh,
  isHintDismissed,
  dismissHint,
  SHEET_HEIGHT_STORAGE_KEY,
  HINT_DISMISSED_STORAGE_KEY,
  MIN_SHEET_VH,
  MAX_SHEET_VH,
  DEFAULT_SHEET_VH,
} from './sheetResize'

function mockLocalStorage(entries: Record<string, string> = {}) {
  const store: Record<string, string> = { ...entries }
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    _store: store,
  })
  return store
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('clampSheetHeightVh', () => {
  it('clamps to the minimum when the drag would push below it', () => {
    // Dragging far down (large positive delta) shrinks the sheet.
    expect(clampSheetHeightVh(55, 10_000, 800)).toBe(MIN_SHEET_VH)
  })

  it('clamps to the maximum when the drag would push above it', () => {
    // Dragging far up (large negative delta) grows the sheet.
    expect(clampSheetHeightVh(55, -10_000, 800)).toBe(MAX_SHEET_VH)
  })

  it('returns the expected mid-range value for a normal drag', () => {
    // 80px upward drag on an 800px viewport == 10vh growth.
    expect(clampSheetHeightVh(55, -80, 800)).toBe(65)
  })

  it('returns the expected mid-range value for a downward drag', () => {
    // 80px downward drag on an 800px viewport == 10vh shrink.
    expect(clampSheetHeightVh(55, 80, 800)).toBe(45)
  })

  it('is a no-op for a zero delta', () => {
    expect(clampSheetHeightVh(55, 0, 800)).toBe(55)
  })
})

describe('getStoredSheetHeightVh / setStoredSheetHeightVh', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  it('restores a valid stored value', () => {
    mockLocalStorage({ [SHEET_HEIGHT_STORAGE_KEY]: '70' })
    expect(getStoredSheetHeightVh()).toBe(70)
  })

  it('falls back to the default when nothing is stored', () => {
    expect(getStoredSheetHeightVh()).toBe(DEFAULT_SHEET_VH)
  })

  it('falls back to the default for a corrupt (non-numeric) value', () => {
    mockLocalStorage({ [SHEET_HEIGHT_STORAGE_KEY]: 'not-a-number' })
    expect(getStoredSheetHeightVh()).toBe(DEFAULT_SHEET_VH)
  })

  it('falls back to the default for a value below the minimum bound', () => {
    mockLocalStorage({ [SHEET_HEIGHT_STORAGE_KEY]: '5' })
    expect(getStoredSheetHeightVh()).toBe(DEFAULT_SHEET_VH)
  })

  it('falls back to the default for a value above the maximum bound', () => {
    mockLocalStorage({ [SHEET_HEIGHT_STORAGE_KEY]: '150' })
    expect(getStoredSheetHeightVh()).toBe(DEFAULT_SHEET_VH)
  })

  it('writes the value so a later read restores it', () => {
    const store = mockLocalStorage()
    setStoredSheetHeightVh(80)
    expect(store[SHEET_HEIGHT_STORAGE_KEY]).toBe('80')
    expect(getStoredSheetHeightVh()).toBe(80)
  })
})

describe('isHintDismissed / dismissHint', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  it('is false when the flag has never been set', () => {
    expect(isHintDismissed()).toBe(false)
  })

  it('stays true once dismissed', () => {
    dismissHint()
    expect(isHintDismissed()).toBe(true)
  })

  it('is true when the stored flag is already set', () => {
    mockLocalStorage({ [HINT_DISMISSED_STORAGE_KEY]: 'true' })
    expect(isHintDismissed()).toBe(true)
  })
})
