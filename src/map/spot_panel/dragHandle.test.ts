import { describe, it, expect } from 'vitest'
import { nearestSnapPoint } from './dragHandle'

describe('nearestSnapPoint', () => {
  it('resolves values inside the peek band to "peek"', () => {
    expect(nearestSnapPoint(0)).toBe('peek')
    expect(nearestSnapPoint(15)).toBe('peek')
    expect(nearestSnapPoint(25)).toBe('peek')
  })

  it('resolves values inside the half band to "half"', () => {
    expect(nearestSnapPoint(40)).toBe('half')
    expect(nearestSnapPoint(56)).toBe('half')
    expect(nearestSnapPoint(70)).toBe('half')
  })

  it('resolves values inside the full band to "full"', () => {
    expect(nearestSnapPoint(80)).toBe('full')
    expect(nearestSnapPoint(92)).toBe('full')
    expect(nearestSnapPoint(100)).toBe('full')
  })

  it('breaks the exact peek/half midpoint (35.5) toward peek', () => {
    expect(nearestSnapPoint(35.5)).toBe('peek')
  })

  it('breaks the exact half/full midpoint (74) toward half', () => {
    expect(nearestSnapPoint(74)).toBe('half')
  })

  it('resolves just past each midpoint to the other side', () => {
    expect(nearestSnapPoint(35.6)).toBe('half')
    expect(nearestSnapPoint(74.1)).toBe('full')
  })
})
