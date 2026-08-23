import { describe, it, expect } from 'vitest'
import { resolveExternalLinkUrl } from './externalLink'

const CURRENT = 'https://trailradar.org/map'

describe('resolveExternalLinkUrl', () => {
  it('returns the absolute URL for a cross-origin http(s) link', () => {
    expect(resolveExternalLinkUrl('https://www.instagram.com/trailradar.germany', CURRENT))
      .toBe('https://www.instagram.com/trailradar.germany')
  })

  it('resolves a protocol-relative cross-origin link to an absolute URL', () => {
    expect(resolveExternalLinkUrl('//paypal.com/donate', CURRENT))
      .toBe('https://paypal.com/donate')
  })

  it('returns null for a same-origin absolute link', () => {
    expect(resolveExternalLinkUrl('https://trailradar.org/privacy', CURRENT)).toBeNull()
  })

  it('returns null for a same-origin relative link', () => {
    expect(resolveExternalLinkUrl('/privacy', CURRENT)).toBeNull()
  })

  it('returns null for a hash-only anchor link', () => {
    expect(resolveExternalLinkUrl('#elevation-profile', CURRENT)).toBeNull()
  })

  it('returns null for a null href (e.g. an <a> with no href attribute)', () => {
    expect(resolveExternalLinkUrl(null, CURRENT)).toBeNull()
  })

  it('returns null for an empty href', () => {
    expect(resolveExternalLinkUrl('', CURRENT)).toBeNull()
  })

  it('returns null for a mailto: link', () => {
    expect(resolveExternalLinkUrl('mailto:hello@trailradar.org', CURRENT)).toBeNull()
  })

  it('returns null for a tel: link', () => {
    expect(resolveExternalLinkUrl('tel:+491234567', CURRENT)).toBeNull()
  })

  it('returns null for an unparseable href', () => {
    expect(resolveExternalLinkUrl('http://[not-a-valid-host', CURRENT)).toBeNull()
  })
})
