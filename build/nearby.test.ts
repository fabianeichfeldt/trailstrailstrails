import { describe, it, expect } from 'vitest'
import { haversineKm, computeNearbyMap, type SpotLite } from './nearby'

function spot(overrides: Partial<SpotLite> = {}): SpotLite {
  return {
    id: 'x',
    name: 'Spot',
    latitude: 48,
    longitude: 11,
    type: 'trail',
    approved: true,
    ...overrides,
  }
}

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(48.1, 11.5, 48.1, 11.5)).toBe(0)
  })

  it('is ~111km per degree of latitude', () => {
    const d = haversineKm(48, 11, 49, 11)
    expect(d).toBeGreaterThan(110)
    expect(d).toBeLessThan(112)
  })
})

describe('computeNearbyMap', () => {
  const base: SpotLite[] = [
    spot({ id: 'a', name: 'Alpha', latitude: 48.0, longitude: 11.0 }),
    spot({ id: 'b', name: 'Bravo', latitude: 48.1, longitude: 11.0 }), // ~11km from a
    spot({ id: 'c', name: 'Charlie', latitude: 48.2, longitude: 11.0 }), // ~22km from a
    spot({ id: 'd', name: 'Delta', latitude: 48.3, longitude: 11.0 }), // ~33km from a
    spot({ id: 'e', name: 'Echo', latitude: 48.4, longitude: 11.0 }),
    spot({ id: 'f', name: 'Foxtrot', latitude: 48.5, longitude: 11.0 }),
    spot({ id: 'g', name: 'Golf', latitude: 48.6, longitude: 11.0 }),
  ]

  it('gives every input spot a key, even unapproved ones', () => {
    const spots = [...base, spot({ id: 'z', name: 'Zulu', approved: false })]
    const map = computeNearbyMap(spots)
    expect(Object.keys(map).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'z'])
  })

  it('returns at most `count` neighbours (default 5)', () => {
    const map = computeNearbyMap(base)
    expect(map.a.length).toBe(5)
  })

  it('orders neighbours by ascending distance', () => {
    const map = computeNearbyMap(base)
    const kms = map.a.map(n => n.km)
    expect(kms).toEqual([...kms].sort((x, y) => x - y))
    expect(map.a[0].id).toBe('b')
  })

  it('excludes the spot itself', () => {
    const map = computeNearbyMap(base)
    expect(map.a.some(n => n.id === 'a')).toBe(false)
  })

  it('drops candidates beyond maxKm', () => {
    const spots = [
      spot({ id: 'a', name: 'Alpha', latitude: 48.0, longitude: 11.0 }),
      spot({ id: 'far', name: 'Far', latitude: 60.0, longitude: 11.0 }),
    ]
    const map = computeNearbyMap(spots, { maxKm: 100 })
    expect(map.a).toEqual([])
  })

  it('excludes unapproved spots from being neighbours of others', () => {
    const spots = [
      spot({ id: 'a', name: 'Alpha', latitude: 48.0, longitude: 11.0 }),
      spot({ id: 'u', name: 'Unapproved', latitude: 48.01, longitude: 11.0, approved: false }),
    ]
    const map = computeNearbyMap(spots)
    // 'a' has no approved neighbour — 'u' is unapproved.
    expect(map.a).toEqual([])
    // ...but an unapproved spot still gets its own key with approved neighbours.
    expect(map.u.map(n => n.id)).toEqual(['a'])
  })

  it('tie-breaks equal-distance candidates by name', () => {
    const spots = [
      spot({ id: 'origin', name: 'Origin', latitude: 0, longitude: 0 }),
      spot({ id: 'east', name: 'Zeta', latitude: 0, longitude: 0.5 }),
      spot({ id: 'west', name: 'Alpha', latitude: 0, longitude: -0.5 }),
    ]
    const map = computeNearbyMap(spots)
    expect(map.origin.map(n => n.name)).toEqual(['Alpha', 'Zeta'])
  })

  it('attaches a photo when the neighbour id is in photoBySpotId', () => {
    const map = computeNearbyMap(base, {
      photoBySpotId: { b: 'https://example.com/b.jpg' },
    })
    const b = map.a.find(n => n.id === 'b')!
    expect(b.photo).toBe('https://example.com/b.jpg')
  })

  it('leaves the photo key off entirely when there is no photo', () => {
    const map = computeNearbyMap(base)
    const b = map.a.find(n => n.id === 'b')!
    expect('photo' in b).toBe(false)
  })

  it('rounds km to one decimal', () => {
    const map = computeNearbyMap(base)
    for (const n of map.a) {
      expect(n.km).toBe(Math.round(n.km * 10) / 10)
    }
  })
})
