import { describe, it, expect } from 'vitest'
import { orderPolylines, resolveShowGpx, type MiniMapInput, type MiniMapPolyline } from './miniMap'

// createMiniMap() itself is browser-bound (Leaflet) — its rendering is
// covered by SpotDetailMiniMap.test.ts (mocked) and the E2E specs. Only the
// pure decision helpers are unit-tested here.

function poly(id: string, kind: 'trail' | 'tour'): MiniMapPolyline {
  return { id, kind, name: id, difficulty: kind === 'trail' ? 'blue' : null, points: [[0, 0, 0], [1, 1, 0]] }
}

describe('orderPolylines', () => {
  it('puts every tour before every trail so trail hit-areas end up on top', () => {
    const ordered = orderPolylines([poly('t1', 'trail'), poly('to1', 'tour'), poly('t2', 'trail'), poly('to2', 'tour')])
    expect(ordered.map(p => p.id)).toEqual(['to1', 'to2', 't1', 't2'])
  })

  it('preserves the relative order within tours and within trails', () => {
    const ordered = orderPolylines([poly('a', 'trail'), poly('b', 'trail')])
    expect(ordered.map(p => p.id)).toEqual(['a', 'b'])
  })

  it('does not mutate the input array', () => {
    const input = [poly('t1', 'trail'), poly('to1', 'tour')]
    orderPolylines(input)
    expect(input.map(p => p.id)).toEqual(['t1', 'to1'])
  })
})

describe('resolveShowGpx', () => {
  const base: MiniMapInput = { center: [47, 11], zoom: 11, polylines: [], markers: [] }

  it('honours an explicit showGpxAtZoom override regardless of zoom/polylines', () => {
    expect(resolveShowGpx({ ...base, polylines: [poly('t', 'trail')], zoom: 5 }, { interactive: true, showGpxAtZoom: true })).toBe(true)
    expect(resolveShowGpx({ ...base, polylines: [poly('t', 'trail')], zoom: 18 }, { interactive: true, showGpxAtZoom: false })).toBe(false)
  })

  it('shows GPX when there are polylines and zoom is at/above the threshold', () => {
    expect(resolveShowGpx({ ...base, polylines: [poly('t', 'trail')], zoom: 11 }, { interactive: true })).toBe(true)
  })

  it('falls back to the spot marker when zoomed out below the threshold', () => {
    expect(resolveShowGpx({ ...base, polylines: [poly('t', 'trail')], zoom: 9 }, { interactive: true })).toBe(false)
  })

  it('falls back to the spot marker when there is no GPX at all', () => {
    expect(resolveShowGpx({ ...base, polylines: [], zoom: 14 }, { interactive: true })).toBe(false)
  })
})
