import { describe, it, expect } from 'vitest'
import type { ConditionRange } from '~/types/Weather'
import { nextRange, sameRange } from './soilFeedback'

const r = (lo: number, hi: number) => ({ lo, hi }) as ConditionRange

describe('nextRange', () => {
  it('first tap on the untouched model range selects that segment alone', () => {
    expect(nextRange(r(1, 2), 3, r(1, 2))).toEqual(r(3, 3))
    expect(nextRange(r(1, 2), 0, r(1, 2))).toEqual(r(0, 0))
    expect(nextRange(r(1, 2), 1, r(1, 2))).toEqual(r(1, 1))
  })

  it('first tap on an untouched single-segment estimate elsewhere selects alone', () => {
    expect(nextRange(r(1, 1), 2, r(1, 1))).toEqual(r(2, 2))
  })

  it('tapping another segment while one is selected extends the range to include it', () => {
    expect(nextRange(r(2, 2), 3, r(1, 2))).toEqual(r(2, 3))
    expect(nextRange(r(2, 2), 0, r(1, 2))).toEqual(r(0, 2))
    expect(nextRange(r(0, 0), 3, r(1, 2))).toEqual(r(0, 3))
  })

  it('extends an existing multi-segment range at either end', () => {
    expect(nextRange(r(1, 2), 3, r(0, 0))).toEqual(r(1, 3))
    expect(nextRange(r(1, 2), 0, r(3, 3))).toEqual(r(0, 2))
  })

  it('tapping the lone selected segment again resets to the model range', () => {
    expect(nextRange(r(3, 3), 3, r(1, 2))).toEqual(r(1, 2))
    expect(nextRange(r(0, 0), 0, r(1, 1))).toEqual(r(1, 1))
  })

  it('tapping inside a multi-segment range narrows it to that segment', () => {
    expect(nextRange(r(0, 3), 2, r(1, 2))).toEqual(r(2, 2))
    expect(nextRange(r(1, 2), 1, r(0, 0))).toEqual(r(1, 1))
  })

  it('returns a new object, never the model range instance itself', () => {
    const model = r(1, 2)
    expect(nextRange(r(3, 3), 3, model)).not.toBe(model)
  })

  it('works at the new last segment (index 4, wet) introduced by the dry level', () => {
    expect(nextRange(r(2, 3), 4, r(2, 3))).toEqual(r(4, 4))
    expect(nextRange(r(4, 4), 4, r(2, 3))).toEqual(r(2, 3))
    expect(nextRange(r(3, 3), 4, r(0, 1))).toEqual(r(3, 4))
  })
})

describe('sameRange', () => {
  it('compares by value', () => {
    expect(sameRange(r(1, 2), r(1, 2))).toBe(true)
    expect(sameRange(r(1, 2), r(1, 3))).toBe(false)
    expect(sameRange(r(0, 2), r(1, 2))).toBe(false)
  })
})
