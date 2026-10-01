import { describe, it, expect } from 'vitest';
import { normalizeWebsiteUrl } from './spotWebsite';

describe('normalizeWebsiteUrl', () => {
  it('trims whitespace', () => {
    expect(normalizeWebsiteUrl('  https://a.de/x  ')).toEqual({ ok: true, url: 'https://a.de/x' });
  });
  it('returns empty string for blank input', () => {
    expect(normalizeWebsiteUrl('   ')).toEqual({ ok: true, url: '' });
  });
  it('accepts http and https', () => {
    expect(normalizeWebsiteUrl('http://a.de').ok).toBe(true);
    expect(normalizeWebsiteUrl('HTTPS://a.de').ok).toBe(true);
  });
  it('rejects other schemes', () => {
    expect(normalizeWebsiteUrl('javascript:alert(1)').ok).toBe(false);
    expect(normalizeWebsiteUrl('ftp://a.de').ok).toBe(false);
  });
  it('does not prepend a scheme', () => {
    expect(normalizeWebsiteUrl('example.com').ok).toBe(false);
  });
  it('rejects whitespace inside and length over 500', () => {
    expect(normalizeWebsiteUrl('https://a.de/a b').ok).toBe(false);
    expect(normalizeWebsiteUrl('https://a.de/' + 'x'.repeat(500)).ok).toBe(false);
    expect(normalizeWebsiteUrl('https://a.de/' + 'x'.repeat(400)).ok).toBe(true);
  });
});
