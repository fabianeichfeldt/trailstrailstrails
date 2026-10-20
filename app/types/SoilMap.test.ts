import { describe, it, expect } from 'vitest'
import { isFrost } from './SoilMap'

describe('isFrost', () => {
  it('is true only for snow', () => {
    expect(isFrost('snow')).toBe(true)
    expect(isFrost('wet')).toBe(false)
    expect(isFrost('hard')).toBe(false)
  })
})
