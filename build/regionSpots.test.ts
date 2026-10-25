import { describe, test, expect } from 'vitest'
import { assignSpotsToRegions, isRegionIndexable, type RegionSourceSpot } from './regionSpots'
import type { Regions } from './region'

const regions: Regions = {
  city: { pronom: 'in X', lat: 50, lng: 10, zoom: 10 },
  wide: { pronom: 'in Y', lat: 50, lng: 10, zoom: 9, descr: 'd' },
  country: { pronom: 'in Z', lat: 50, lng: 10, zoom: 7 },
  empty: { pronom: 'in W', lat: 0, lng: 0, zoom: 12 },
}
const spot = (id: string, latitude: number, extra: Partial<RegionSourceSpot> = {}): RegionSourceSpot =>
  ({ id, slug: id, name: id, type: 'trail', approved: true, latitude, longitude: 10, ...extra })

describe('assignSpotsToRegions', () => {
  test('radius by zoom, nearest first, rounded km, every region keyed', () => {
    // 1 deg lat ~ 111.2 km
    const out = assignSpotsToRegions(
      [spot('far', 50.5), spot('near', 50.1), spot('mid', 50.4), spot('out', 51)],
      regions,
    )
    expect(Object.keys(out).sort()).toEqual(['city', 'country', 'empty', 'wide'])
    expect(out.city!.map(s => s.slug)).toEqual(['near', 'mid']) // 50 km: 11.1, 44.5
    expect(out.wide!.map(s => s.slug)).toEqual(['near', 'mid', 'far']) // 70 km
    expect(out.city![0]!.distanceKm).toBe(11.1)
    expect(out.country).toEqual([])
    expect(out.empty).toEqual([])
  })

  test('slug falls back to id, caps at 60', () => {
    const many = Array.from({ length: 80 }, (_, i) => spot(`s${i}`, 50 + i * 0.001, { slug: i === 0 ? '' : `s${i}` }))
    const out = assignSpotsToRegions(many, regions)
    expect(out.city).toHaveLength(60)
    expect(out.city![0]!.slug).toBe('s0')
    expect(out.city![0]).not.toHaveProperty('km')
  })
})

test('isRegionIndexable needs copy or spots', () => {
  expect(isRegionIndexable({}, [])).toBe(false)
  expect(isRegionIndexable({ descr: 'x' }, [])).toBe(true)
  expect(isRegionIndexable({ descr: '' }, [{ slug: 'a', name: 'a', type: 'trail', approved: true, distanceKm: 1 }])).toBe(true)
})
