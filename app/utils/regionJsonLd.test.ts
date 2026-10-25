import { describe, it, expect } from 'vitest'
import { buildRegionBreadcrumb, buildRegionItemList, isRegionThin, regionCountSentence } from './regionJsonLd'

const s = (slug: string, approved = true) => ({ slug, name: slug.toUpperCase(), type: 'trail' as const, approved, distanceKm: 1 })

describe('region json-ld', () => {
  it('breadcrumb is Start -> region', () => {
    const b = buildRegionBreadcrumb('allgaeu', 'im Allgäu') as any
    expect(b.itemListElement[1].item).toBe('https://trailradar.org/trails/allgaeu/')
  })
  it('item list has positions, urls and names', () => {
    const l = buildRegionItemList('im Allgäu', [s('a'), s('b')]) as any
    expect(l.itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, url: 'https://trailradar.org/trails/b/', name: 'B' })
  })
  it('thin = no descr and no spots', () => {
    expect(isRegionThin({}, [])).toBe(true)
    expect(isRegionThin({ descr: 'x' }, [])).toBe(false)
    expect(isRegionThin({}, [s('a')])).toBe(false)
  })
  it('count sentence stays truthful', () => {
    expect(regionCountSentence('im Allgäu', [s('a'), s('b')])).toBe('2 offizielle MTB-Spots im Allgäu')
    expect(regionCountSentence('im Allgäu', [s('a', false)])).toBe('1 MTB-Spot im Allgäu')
    expect(regionCountSentence('im Allgäu', [s('a'), s('b', false)])).toBe('2 MTB-Spots im Allgäu, davon 1 offiziell')
    expect(regionCountSentence('im Allgäu', [s('a')])).toBe('1 offizieller MTB-Spot im Allgäu')
    expect(regionCountSentence('x', [])).toBe('')
  })
})
