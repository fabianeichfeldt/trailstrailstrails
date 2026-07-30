import { describe, it, expect } from 'vitest'
import { roundCoord } from './coords'

describe('roundCoord', () => {
  it('rounds to 6 decimal places', () => {
    expect(roundCoord(47.812345678)).toBe(47.812346)
  })

  it('leaves already-short values unchanged', () => {
    expect(roundCoord(13.0)).toBe(13.0)
  })

  it('handles negative coordinates', () => {
    expect(roundCoord(-122.419416123)).toBe(-122.419416)
  })
})
