// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { extractHostname, isHostAllowed, resolveHostname } from './embedHostValidation'

describe('extractHostname', () => {
  test('extracts hostname from Origin header', () => {
    expect(extractHostname('https://deutscheralpenverein.de')).toBe('deutscheralpenverein.de')
  })

  test('extracts hostname from Referer with path', () => {
    expect(extractHostname('https://example.com/page?q=1')).toBe('example.com')
  })

  test('handles localhost', () => {
    expect(extractHostname('http://localhost:3000')).toBe('localhost')
  })

  test('returns null for null', () => {
    expect(extractHostname(null)).toBeNull()
  })

  test('returns null for empty string', () => {
    expect(extractHostname('')).toBeNull()
  })

  test('returns null for unparseable string', () => {
    expect(extractHostname('not a url')).toBeNull()
  })
})

describe('isHostAllowed', () => {
  test('allows an exact match', () => {
    expect(isHostAllowed('deutscheralpenverein.de', ['deutscheralpenverein.de', 'localhost'])).toBe(true)
  })

  test('allows localhost', () => {
    expect(isHostAllowed('localhost', ['localhost'])).toBe(true)
  })

  test('rejects a host not in the list', () => {
    expect(isHostAllowed('evil.com', ['deutscheralpenverein.de'])).toBe(false)
  })

  test('rejects when allowed list is empty', () => {
    expect(isHostAllowed('localhost', [])).toBe(false)
  })

  test('rejects null hostname', () => {
    expect(isHostAllowed(null, ['localhost'])).toBe(false)
  })

  test('does not allow subdomains implicitly', () => {
    expect(isHostAllowed('sub.deutscheralpenverein.de', ['deutscheralpenverein.de'])).toBe(false)
  })
})

describe('resolveHostname', () => {
  test('uses parentHost first when present', () => {
    expect(resolveHostname('trailradar.org', 'https://trailradar.org', 'https://trailradar.org/embed/tok')).toBe('trailradar.org')
  })

  test('falls back to origin when parentHost is null', () => {
    expect(resolveHostname(null, 'https://trailradar.org', null)).toBe('trailradar.org')
  })

  test('falls back to referer when parentHost and origin are absent', () => {
    expect(resolveHostname(null, null, 'https://example.com/page')).toBe('example.com')
  })

  test('returns null when all sources are absent', () => {
    expect(resolveHostname(null, null, null)).toBeNull()
  })

  test('empty string parentHost is returned as-is (caller should pass null, not empty string)', () => {
    expect(resolveHostname('', 'https://trailradar.org', null)).toBe('')
  })
})
