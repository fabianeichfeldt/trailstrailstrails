import { describe, it, expect } from 'vitest'
import { filterSpots, shouldShowSpotSearch } from './spotFilter'

const spots = ['Bikepark Leogang', 'Salzburg Süd', 'Hometrail Wien', 'Kitzbühel', 'Innsbruck'].map((name, i) => ({ id: String(i), name }))

describe('shouldShowSpotSearch', () => {
  it('hides for fewer than 5 spots, shows from 5', () => {
    expect(shouldShowSpotSearch(4)).toBe(false)
    expect(shouldShowSpotSearch(5)).toBe(true)
  })
})

describe('filterSpots', () => {
  it('returns all for blank query', () => {
    expect(filterSpots(spots, '')).toHaveLength(5)
    expect(filterSpots(spots, '   ')).toHaveLength(5)
  })
  it('matches case-insensitively as substring', () => {
    expect(filterSpots(spots, 'SALZ').map(s => s.name)).toEqual(['Salzburg Süd'])
    expect(filterSpots(spots, 'trail').map(s => s.name)).toEqual(['Hometrail Wien'])
  })
  it('returns empty when nothing matches', () => {
    expect(filterSpots(spots, 'xyz')).toEqual([])
  })
})
