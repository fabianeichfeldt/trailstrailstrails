import { describe, it, expect } from 'vitest'
import { SOIL_SCALE, SOIL_AXIS_MAX, SOIL_PALETTE, SOIL_LABELS, isSoilVerdict, isSoilMapLevel, soilAxis } from './soilScale'

describe('soilScale', () => {
  it('orders the scale dry to wet with a palette and label per position', () => {
    expect([...SOIL_SCALE]).toEqual(['dusty', 'dry', 'prime', 'damp', 'wet'])
    expect(SOIL_AXIS_MAX).toBe(4)
    expect(SOIL_PALETTE).toHaveLength(SOIL_SCALE.length)
    for (const l of SOIL_SCALE) expect(SOIL_LABELS[l]).toBeTruthy()
  })

  it('isSoilVerdict is true only for the five scale levels', () => {
    for (const l of SOIL_SCALE) expect(isSoilVerdict(l)).toBe(true)
    for (const l of ['raining', 'snow', 'hard', 'unknown', undefined] as const) expect(isSoilVerdict(l)).toBe(false)
  })

  it('isSoilMapLevel adds raining and snow', () => {
    expect(isSoilMapLevel('raining')).toBe(true)
    expect(isSoilMapLevel('snow')).toBe(true)
    expect(isSoilMapLevel('hard')).toBe(false)
    expect(isSoilMapLevel(undefined)).toBe(false)
  })

  it('soilAxis maps scale index, with raining=3 and snow=4', () => {
    expect(SOIL_SCALE.map(soilAxis)).toEqual([0, 1, 2, 3, 4])
    expect(soilAxis('raining')).toBe(3)
    expect(soilAxis('snow')).toBe(4)
    expect(soilAxis('hard')).toBeNull()
    expect(soilAxis('unknown')).toBeNull()
    expect(soilAxis(undefined)).toBeNull()
  })
})
