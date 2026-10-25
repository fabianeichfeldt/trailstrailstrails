// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./[slug].vue', import.meta.url), 'utf8')

describe('trails/[slug].vue SEO wiring', () => {
  test('fails only the prerender for a missing spot', () => {
    expect(src).toContain('spotNotFoundPolicy')
    expect(src).toMatch(/if \(notFound\.fail404\) throw createError\(\{ statusCode: 404/)
    expect(src).toContain('import.meta.prerender')
  })
  test('links all regions with trailing slashes', () => {
    expect(src).not.toContain('.slice(0, 12)')
    expect(src).not.toMatch(/:to="`\/trails/)
  })
  test('uses the Trailradar brand spelling', () => {
    expect(src).toContain("ogSiteName: 'Trailradar'")
    expect(src).not.toMatch(/TrailRadar|Trailradar\.org'/)
  })
  test('renders the crawlable region list and the spot summary', () => {
    expect(src).toContain('<RegionSpotList')
    expect(src).toContain('<SpotDetailSummary')
  })
})
