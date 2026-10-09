import { describe, it, expect } from 'vitest'
import { normalizeWebsiteUrl } from './spotWebsite'

describe('normalizeWebsiteUrl', () => {
  it('trims and accepts http(s) urls', () => {
    expect(normalizeWebsiteUrl('  https://example.com/a?b=1 ')).toEqual({ ok: true, url: 'https://example.com/a?b=1' })
    expect(normalizeWebsiteUrl('HTTP://Example.com')).toEqual({ ok: true, url: 'HTTP://Example.com' })
  })
  it('treats blank, null and undefined as empty', () => {
    expect(normalizeWebsiteUrl('   ')).toEqual({ ok: true, url: '' })
    expect(normalizeWebsiteUrl(null)).toEqual({ ok: true, url: '' })
    expect(normalizeWebsiteUrl(undefined)).toEqual({ ok: true, url: '' })
  })
  it('never prepends a scheme', () => {
    expect(normalizeWebsiteUrl('example.com').ok).toBe(false)
  })
  it('rejects other schemes, inner whitespace and bare scheme', () => {
    for (const bad of ['ftp://x.de', 'javascript:alert(1)', 'https://a b.de', 'https://']) {
      const r = normalizeWebsiteUrl(bad)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(/\S/)
    }
  })
  it('limits length to 500', () => {
    const base = 'https://x.de/'
    expect(normalizeWebsiteUrl(base + 'a'.repeat(500 - base.length)).ok).toBe(true)
    expect(normalizeWebsiteUrl(base + 'a'.repeat(501 - base.length)).ok).toBe(false)
  })
})
