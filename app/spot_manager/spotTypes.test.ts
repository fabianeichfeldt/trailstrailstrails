import { describe, it, expect } from 'vitest'
import { SPOT_CAPABILITIES } from './spotTypes'

describe('SPOT_CAPABILITIES', () => {
  it('has an entry for every spot type', () => {
    expect(Object.keys(SPOT_CAPABILITIES).sort()).toEqual(['bikepark', 'dirtpark', 'trail'])
  })
  it('only trail and bikepark are manageable', () => {
    const m = Object.entries(SPOT_CAPABILITIES).filter(([, c]) => c.manageable).map(([k]) => k).sort()
    expect(m).toEqual(['bikepark', 'trail'])
  })
  it('only trail has gpx', () => {
    const g = Object.entries(SPOT_CAPABILITIES).filter(([, c]) => c.gpx).map(([k]) => k)
    expect(g).toEqual(['trail'])
  })
  it('details kind per type', () => {
    expect(SPOT_CAPABILITIES.trail.details).toBe('trail')
    expect(SPOT_CAPABILITIES.bikepark.details).toBe('bikepark')
    expect(SPOT_CAPABILITIES.dirtpark.details).toBeNull()
  })
})
