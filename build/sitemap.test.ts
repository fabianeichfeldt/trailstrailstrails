import { describe, test, expect } from 'vitest'
import { buildSitemapXml, buildBulkRedirectRows, redirectStubHtml, STATIC_SITEMAP_PATHS } from './sitemap'
import type { Regions } from './region'

const regions: Regions = {
  full: { pronom: 'in A', lat: 0, lng: 0, zoom: 10, descr: 'x' },
  spotty: { pronom: 'in B', lat: 0, lng: 0, zoom: 10 },
  thin: { pronom: 'in C', lat: 0, lng: 0, zoom: 10 },
}
const spot = { slug: 's', name: 's', type: 'trail' as const, approved: true, distanceKm: 1 }

describe('buildSitemapXml', () => {
  const xml = buildSitemapXml({ regions, regionSpots: { full: [], spotty: [spot], thin: [] }, spotSlugs: ['abc'] })
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]!)

  test('every loc ends with a slash', () => {
    expect(locs.length).toBeGreaterThan(5)
    for (const l of locs) expect(l).toMatch(/\/$/)
  })
  test('no lastmod/changefreq/priority', () => {
    expect(xml).not.toMatch(/lastmod|changefreq|priority/)
  })
  test('includes new static pages, spots and indexable regions only', () => {
    expect(locs).toContain('https://trailradar.org/how-to-embed/')
    expect(locs).toContain('https://trailradar.org/trailmanagement/')
    expect(locs).toContain('https://trailradar.org/trails/abc/')
    expect(locs).toContain('https://trailradar.org/trails/full/')
    expect(locs).toContain('https://trailradar.org/trails/spotty/')
    expect(locs).not.toContain('https://trailradar.org/trails/thin/')
  })
  test('static list has the root', () => expect(STATIC_SITEMAP_PATHS).toContain('/'))
})

test('redirect stub has no noindex', () => {
  const html = redirectStubHtml('/trails/x/')
  expect(html).not.toMatch(/noindex/)
  expect(html).toContain('rel="canonical" href="https://trailradar.org/trails/x/"')
})

test('bulk redirect rows cover slash and slashless form, skip unsafe sources', () => {
  expect(buildBulkRedirectRows([{ from: 'old', to: 'new' }, { from: '../x', to: 'y' }, { from: 'a/b', to: 'y' }])).toEqual([
    'trailradar.org/trails/old,https://trailradar.org/trails/new/,301',
    'trailradar.org/trails/old/,https://trailradar.org/trails/new/,301',
  ])
})
