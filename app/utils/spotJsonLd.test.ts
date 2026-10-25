import { describe, it, expect } from 'vitest'
import { buildSpotJsonLd, buildSpotBreadcrumb } from './spotJsonLd'

const base = { slug: 'neuland', name: 'Neuland', description: 'd', latitude: 1, longitude: 2 }
const region = { slug: 'allgaeu', pronom: 'im Allgäu' }

describe('buildSpotJsonLd', () => {
  it('has @id, org refs and canonical url', () => {
    const j = buildSpotJsonLd(base)
    expect(j['@id']).toBe('https://trailradar.org/trails/neuland/#place')
    expect(j.url).toBe('https://trailradar.org/trails/neuland/')
    expect(j.publisher).toEqual({ '@id': 'https://trailradar.org/#organization' })
    expect(j.provider).toEqual({ '@id': 'https://trailradar.org/#organization' })
  })
  it('omits optional fields without data', () => {
    const j = buildSpotJsonLd(base)
    for (const k of ['openingHours', 'isAccessibleForFree', 'containedInPlace', 'image']) expect(j).not.toHaveProperty(k)
  })
  it('maps access type free/paid only', () => {
    expect(buildSpotJsonLd({ ...base, accessType: 'free' }).isAccessibleForFree).toBe(true)
    expect(buildSpotJsonLd({ ...base, accessType: 'paid' }).isAccessibleForFree).toBe(false)
    expect(buildSpotJsonLd({ ...base, accessType: 'membership' })).not.toHaveProperty('isAccessibleForFree')
  })
  it('adds region and opening hours text', () => {
    const j = buildSpotJsonLd({ ...base, region, openingHours: ' Mo-Fr ' })
    expect(j.containedInPlace).toEqual({ '@type': 'Place', name: 'Allgäu', url: 'https://trailradar.org/trails/allgaeu/' })
    expect(j.openingHours).toBe('Mo-Fr')
  })
})

describe('buildSpotBreadcrumb', () => {
  it('goes Start -> Region -> Spot', () => {
    const b = buildSpotBreadcrumb({ ...base, region }) as any
    expect(b.itemListElement.map((x: any) => [x.position, x.name, x.item])).toEqual([
      [1, 'Start', 'https://trailradar.org/'],
      [2, 'Allgäu', 'https://trailradar.org/trails/allgaeu/'],
      [3, 'Neuland', 'https://trailradar.org/trails/neuland/'],
    ])
  })
  it('skips the region when unmatched', () => {
    expect((buildSpotBreadcrumb(base) as any).itemListElement).toHaveLength(2)
  })
})
