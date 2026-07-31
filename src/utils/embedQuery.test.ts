import { describe, test, expect } from 'vitest'
import { parseEmbedQuery, getRequestedSearch } from './embedQuery'

describe('parseEmbedQuery', () => {
  test('parses lat/lng/zoom/parentHost from a populated query string', () => {
    expect(parseEmbedQuery('?lat=52.5&lng=13.4&zoom=10&parentHost=example.com')).toEqual({
      lat: 52.5,
      lng: 13.4,
      zoom: 10,
      parentHost: 'example.com',
    })
  })

  test('falls back to defaults when the query string is genuinely empty', () => {
    expect(parseEmbedQuery('')).toEqual({ lat: 47.8, lng: 13.0, zoom: 10, parentHost: '' })
  })

  // Regression: /embed/[token] is prerendered with the bare path only, no
  // query string. Nuxt's hydration for prerendered dynamic routes briefly
  // resolves to that query-less baked payload before correcting to the
  // real requested URL. Code that read from route.query at setup time
  // could observe that intermediate empty state and silently fall back to
  // the defaults below — making every embed, regardless of the region or
  // trail it was placed on, show the same default location.
  test('does not fall back to defaults when real, non-default coordinates are present', () => {
    const result = parseEmbedQuery('?lat=52.5&lng=13.4&zoom=10&parentHost=example.com')
    expect(result.lat).not.toBe(47.8)
    expect(result.lng).not.toBe(13.0)
  })
})

// Regression: for /embed/[token] (a prerendered dynamic route), Nuxt's
// client-side router rewrites window.location to its own canonical route
// URL — bare path, no trailing slash, no query string — once it takes
// over, and that rewrite stands for the page's lifetime (verified against
// a real `nuxt generate` static build served from a plain HTTP server: the
// actual browser request carried the correct query string, but
// window.location.search read from inside onMounted was already empty).
// window.location can't be trusted at all for this route; the fix reads
// performance.getEntriesByType('navigation')[0].name instead, which
// records the real requested URL and is never touched by that rewrite.
function fakeWindow(opts: { navigationUrl?: string; locationHref: string }): Window {
  return {
    performance: {
      getEntriesByType: (type: string) =>
        type === 'navigation' && opts.navigationUrl ? [{ name: opts.navigationUrl }] : [],
    },
    location: new URL(opts.locationHref),
  } as unknown as Window
}

describe('getRequestedSearch', () => {
  test('reads the query string from the navigation entry, not from window.location', () => {
    const win = fakeWindow({
      navigationUrl: 'https://trailradar.org/embed/tok/?lat=50.1111&lng=11.4606&zoom=11',
      // Simulates Nuxt's router rewrite: location no longer has the query at all.
      locationHref: 'https://trailradar.org/embed/tok',
    })
    expect(getRequestedSearch(win)).toBe('?lat=50.1111&lng=11.4606&zoom=11')
  })

  test('falls back to window.location.href when no navigation entry is available', () => {
    const win = fakeWindow({ locationHref: 'https://trailradar.org/embed/tok?lat=1&lng=2' })
    expect(getRequestedSearch(win)).toBe('?lat=1&lng=2')
  })
})
