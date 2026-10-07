import { describe, it, expect } from 'vitest'
import { levelToAxis, isFrost, SOIL_AXIS_MAX } from './SoilMap'
import type { ConditionLevel } from './Weather'

describe('levelToAxis', () => {
  it.each([
    ['dusty', 0], ['dry', 1], ['prime', 2], ['damp', 3], ['wet', 4],
    ['raining', 3], ['snow', 4], ['hard', null], ['unknown', null],
  ] as [ConditionLevel, number | null][])('%s -> %s', (level, axis) => {
    expect(levelToAxis(level)).toBe(axis)
  })

  it('maps undefined to null', () => {
    expect(levelToAxis(undefined)).toBeNull()
  })

  it('axis max is 4', () => {
    expect(SOIL_AXIS_MAX).toBe(4)
  })
})

describe('isFrost', () => {
  it('is true only for snow', () => {
    expect(isFrost('snow')).toBe(true)
    expect(isFrost('wet')).toBe(false)
    expect(isFrost('hard')).toBe(false)
  })
})
