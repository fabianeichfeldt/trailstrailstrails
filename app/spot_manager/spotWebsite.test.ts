import { describe, it, expect } from 'vitest'
import { normalizeWebsiteUrl } from './spotWebsite'

describe('normalizeWebsiteUrl', () => {
  it('trims and accepts http(s)', () => {
    expect(normalizeWebsiteUrl('  https://a.de/x ')).toEqual({ ok: true, value: 'https://a.de/x' })
    expect(normalizeWebsiteUrl('http://a.de')).toEqual({ ok: true, value: 'http://a.de' })
  })
  it('blank becomes empty string', () => {
    expect(normalizeWebsiteUrl('   ')).toEqual({ ok: true, value: '' })
    expect(normalizeWebsiteUrl(null)).toEqual({ ok: true, value: '' })
  })
  it('rejects non-http schemes and bare hosts (no silent scheme prepend)', () => {
    expect(normalizeWebsiteUrl('javascript:alert(1)').ok).toBe(false)
    expect(normalizeWebsiteUrl('www.a.de').ok).toBe(false)
  })
  it('rejects whitespace inside and length > 500', () => {
    expect(normalizeWebsiteUrl('https://a b').ok).toBe(false)
    expect(normalizeWebsiteUrl('https://a.de/' + 'x'.repeat(500)).ok).toBe(false)
  })
})
