import { describe, it, expect } from 'vitest'
import { buildSpotSummary, findSpotRegion } from './spotSummary'

const sp = (slug: string, distanceKm: number) => ({ slug, name: slug, type: 'trail' as const, approved: true, distanceKm })

describe('buildSpotSummary', () => {
  it('states type, official status and place', () => {
    expect(buildSpotSummary({ name: 'Neuland', type: 'trail', approved: true, region: { slug: 'allgaeu', pronom: 'im Allgäu' } }))
      .toBe('Neuland ist ein offizieller Trail im Allgäu.')
  })
  it('omits official and place when unknown', () => {
    expect(buildSpotSummary({ name: 'X', type: 'bikepark', approved: false })).toBe('X ist ein Bikepark.')
  })
  it('adds opening hours but never invents them', () => {
    const s = buildSpotSummary({ name: 'X', type: 'trail', openingHours: 'Mo-Fr 9-17' })
    expect(s).toContain('Öffnungszeiten / Fahrverbote: Mo-Fr 9-17.')
    expect(buildSpotSummary({ name: 'X', type: 'trail' })).not.toContain('Öffnungszeiten')
  })
  it('includes live status only on request and skips unknown', () => {
    const i = { name: 'X', type: 'trail' as const, status: 'closed' as const }
    expect(buildSpotSummary(i)).not.toContain('gesperrt')
    expect(buildSpotSummary(i, { includeStatus: true })).toContain('Aktuell gesperrt.')
    expect(buildSpotSummary({ ...i, status: 'unknown' }, { includeStatus: true })).not.toContain('Aktuell')
  })
  it('truncates very long opening hours', () => {
    expect(buildSpotSummary({ name: 'X', type: 'trail', openingHours: 'a '.repeat(200) })).toContain('…')
  })
})

describe('findSpotRegion', () => {
  const regions = { a: { pronom: 'in A' }, b: { pronom: 'in B' } }
  it('picks the region with the smallest distance', () => {
    expect(findSpotRegion('s', { a: [sp('s', 20)], b: [sp('s', 5)] }, regions)).toEqual({ slug: 'b', pronom: 'in B' })
  })
  it('returns null when no region lists the slug', () => {
    expect(findSpotRegion('s', { a: [sp('o', 1)] }, regions)).toBeNull()
  })
})
