import { describe, test, expect } from 'vitest'
import { parseEmbedQuery } from './embedQuery'

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
