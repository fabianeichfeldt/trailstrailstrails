import { describe, it, expect } from 'vitest'
import { markerIconOptions, parkingIconOptions } from './markerIcon'

describe('markerIconOptions', () => {
  it('uses the bikepark category for bikeparks', () => {
    expect(markerIconOptions('bikepark', true).html).toContain('map-pin-bikepark')
  })

  it('uses verified/unverified categories for trails based on approval', () => {
    expect(markerIconOptions('trail', true).html).toContain('map-pin-verified')
    expect(markerIconOptions('trail', false).html).toContain('map-pin-unverified')
  })
})

describe('parkingIconOptions', () => {
  it('renders a circular "P" badge, not the teardrop map-pin shape', () => {
    const opts = parkingIconOptions()
    expect(opts.html).toContain('parking-pin')
    expect(opts.html).toContain('>P<')
    expect(opts.html).not.toContain('map-pin')
  })

  it('is centered (anchor at the middle of the icon), unlike the teardrop pin', () => {
    const opts = parkingIconOptions()
    expect(opts.iconAnchor).toEqual([opts.iconSize[0] / 2, opts.iconSize[1] / 2])
  })

  it('returns a stable className so no wrapper styling is required', () => {
    expect(parkingIconOptions().className).toBe('')
  })
})
