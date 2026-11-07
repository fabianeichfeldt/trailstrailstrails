import { describe, it, expect } from 'vitest'
import { gpxOverview, uncachedIds, clusterSize, trailStyle, TOUR_STYLE, type GpxCacheEntry } from './gpxOverview'

const spot = (id: string) => ({ id, name: `Spot ${id}`, latitude: 1, longitude: 2, type: 'trail' }) as any
const pts = (n: number): [number, number, number][] => Array.from({ length: n }, (_, i) => [i, i + 0.5, 100 + i])
const NOW = new Date('2026-06-15T12:00:00Z')
const trail = (over: any = {}) => ({ name: 'T', difficulty: 'blue', gpx_points: pts(4), ...over })

describe('gpxOverview', () => {
  it('gives every spot a pin, tracks or not', () => {
    const v = gpxOverview([spot('a'), spot('b')], new Map([['a', { trails: [trail()], tours: [] }]]), new Map(), NOW)
    expect(v.pins.map(s => s.id)).toEqual(['a', 'b'])
    expect(v.lines).toHaveLength(1)
  })

  it('orders tours before trails per spot, spot by spot', () => {
    const cache = new Map<string, GpxCacheEntry>([
      ['a', { trails: [trail({ name: 'ta' })], tours: [{ name: 'oa', gpx_points: pts(2) }] }],
      ['b', { trails: [trail({ name: 'tb' })], tours: [] }],
    ])
    const v = gpxOverview([spot('a'), spot('b')], cache, new Map(), NOW)
    expect(v.lines.map(l => `${l.spot.id}:${l.kind}:${l.name}`)).toEqual(['a:tour:oa', 'a:trail:ta', 'b:trail:tb'])
  })

  it('styles tours dashed grey and trails by difficulty colour', () => {
    const cache = new Map<string, GpxCacheEntry>([['a', { trails: [trail({ difficulty: 'red' })], tours: [{ name: 'o', gpx_points: pts(2) }] }]])
    const [tour, tr] = gpxOverview([spot('a')], cache, new Map(), NOW).lines
    expect(tour.style).toEqual({ color: '#555', weight: 3, opacity: 0.6, dashArray: '8, 6' })
    expect(tour.difficulty).toBeNull()
    expect(tr.style).toEqual({ color: '#c62828', weight: 4, opacity: 0.85 })
    expect(tr.difficulty).toBe('red')
  })

  it('falls back to grey for a difficulty without a colour', () => {
    expect(trailStyle('purple')).toEqual({ color: '#888', weight: 4, opacity: 0.85 })
    expect(TOUR_STYLE.dashArray).toBe('8, 6')
  })

  it('carries points, latlngs (altitude dropped) and the description; tours have none', () => {
    const cache = new Map<string, GpxCacheEntry>([['a', {
      trails: [trail({ gpx_points: [[1, 2, 3], [4, 5, 6]], trail_description: 'nice' }), trail({ trail_description: null })],
      tours: [{ name: 'o', gpx_points: pts(2) }],
    }]])
    const [tour, t1, t2] = gpxOverview([spot('a')], cache, new Map(), NOW).lines
    expect(t1.latlngs).toEqual([[1, 2], [4, 5]])
    expect(t1.points).toEqual([[1, 2, 3], [4, 5, 6]])
    expect(t1.description).toBe('nice')
    expect(t2.description).toBe('')
    expect(tour.description).toBe('')
  })

  describe('status badges', () => {
    const run = (t: any) => gpxOverview([spot('a')], new Map([['a', { trails: [t], tours: [] }]]), new Map(), NOW).badges

    it('has none for an open trail', () => {
      expect(run(trail())).toEqual([])
      expect(run(trail({ closed_from: '2026-01-01', closed_to: '2026-02-01' }))).toEqual([])
    })

    it('marks a closed trail', () => {
      const [b] = run(trail({ closed_from: '2026-06-01' }))
      expect(b.status.state).toBe('closed')
      expect(b.spot.id).toBe('a')
    })

    it('marks a closing_soon trail, and a hint-only trail', () => {
      expect(run(trail({ closed_from: '2026-07-01' }))[0].status.state).toBe('closing_soon')
      expect(run(trail({ hint: 'wet' }))[0].status.state).toBe('closing_soon')
    })

    it('sits at the middle point (floor(len/2))', () => {
      const t = (n: number) => run(trail({ hint: 'x', gpx_points: pts(n) }))[0]?.latlng
      expect(t(1)).toEqual([0, 0.5])
      expect(t(2)).toEqual([1, 1.5])
      expect(t(3)).toEqual([1, 1.5])
      expect(t(4)).toEqual([2, 2.5])
    })

    it('is skipped for an empty track, but the line is still listed', () => {
      const v = gpxOverview([spot('a')], new Map([['a', { trails: [trail({ hint: 'x', gpx_points: [] })], tours: [] }]]), new Map(), NOW)
      expect(v.badges).toEqual([])
      expect(v.lines).toHaveLength(1)
    })

    it('is never produced for tours', () => {
      const v = gpxOverview([spot('a')], new Map([['a', { trails: [], tours: [{ name: 'o', gpx_points: pts(3) }] }]]), new Map(), NOW)
      expect(v.badges).toEqual([])
    })
  })

  it('lists parking pins with their spot, in spot order', () => {
    const lot = (id: string, lat: number) => ({ id, name: id, lat, lng: lat + 1 })
    const v = gpxOverview(
      [spot('a'), spot('b'), spot('c')], new Map(),
      new Map([['a', [lot('p1', 10), lot('p2', 20)]], ['c', [lot('p3', 30)]]]), NOW,
    )
    expect(v.parking.map(p => [p.spot.id, p.lat, p.lng])).toEqual([['a', 10, 11], ['a', 20, 21], ['c', 30, 31]])
  })

  it('returns empty lists for no spots', () => {
    expect(gpxOverview([], new Map(), new Map(), NOW)).toEqual({ pins: [], lines: [], badges: [], parking: [] })
  })
})

describe('uncachedIds', () => {
  it('returns the ids missing from the cache, keeping empty entries as cached', () => {
    expect(uncachedIds([spot('a'), spot('b'), spot('c')], new Map<string, any>([['a', 1], ['c', []]]))).toEqual(['b'])
    expect(uncachedIds([], new Map())).toEqual([])
  })
})

describe('clusterSize', () => {
  it.each([[0, 'small'], [1, 'small'], [9, 'small'], [10, 'medium'], [99, 'medium'], [100, 'large'], [5000, 'large']] as const)(
    '%i markers → %s', (n, size) => { expect(clusterSize(n)).toBe(size) },
  )
})
