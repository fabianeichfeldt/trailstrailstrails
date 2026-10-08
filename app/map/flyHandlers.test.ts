import { describe, it, expect, vi } from 'vitest'
import { createMapFlyers, parseFlyQuery } from './flyHandlers'

// Only the Leaflet map is faked; the handlers are what the search bar and
// the `?trail=` / `?fly=` deep links call.
function setup(spots: Array<{ id: string; latitude: number; longitude: number }> = []) {
  const map = { flyTo: vi.fn() }
  const flyers = createMapFlyers(map, id => spots.find(s => s.id === id))
  return { map, ...flyers }
}

describe('opening a spot on the map', () => {
  it('centres on the spot at one level closer than the old region-like zoom 11', () => {
    const { map, openTrail } = setup([{ id: 'd1', latitude: 47.49, longitude: 10.72 }])

    openTrail('d1')

    const [center, zoom] = map.flyTo.mock.calls[0]
    expect(center).toEqual([47.49, 10.72])
    expect(zoom).toBe(12)
  })

  it('does nothing for an unknown spot id', () => {
    const { map, openTrail } = setup()
    openTrail('nope')
    expect(map.flyTo).not.toHaveBeenCalled()
  })
})

describe('flying to a place', () => {
  it('uses the given zoom (a town is one level closer than a district)', () => {
    const { map, flyToPlace } = setup()
    flyToPlace(47.49, 10.72, 12)
    expect(map.flyTo.mock.calls[0][1]).toBe(12)
  })

  it('keeps the district zoom 11 when no zoom is given (district, locate-me button)', () => {
    const { map, flyToPlace } = setup()
    flyToPlace(47.49, 10.72)
    expect(map.flyTo.mock.calls[0][1]).toBe(11)
  })
})

describe('parseFlyQuery (?fly=lat,lng&zoom=n)', () => {
  it('reads coordinates and zoom', () => {
    expect(parseFlyQuery('47.5,10.7', '12')).toEqual({ lat: 47.5, lng: 10.7, zoom: 12 })
  })
  it('leaves zoom undefined when absent or garbage', () => {
    expect(parseFlyQuery('47.5,10.7', undefined)?.zoom).toBeUndefined()
    expect(parseFlyQuery('47.5,10.7', 'abc')?.zoom).toBeUndefined()
    expect(parseFlyQuery('47.5,10.7', '99')?.zoom).toBeUndefined()
  })
  it('returns null for unparseable coordinates', () => {
    expect(parseFlyQuery('x,y', '12')).toBeNull()
    expect(parseFlyQuery(undefined, '12')).toBeNull()
  })
})
