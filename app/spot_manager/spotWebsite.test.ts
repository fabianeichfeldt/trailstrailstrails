import { describe, it, expect } from 'vitest';
import { normalizeWebsiteUrl } from './spotWebsite';

describe('normalizeWebsiteUrl', () => {
  it('trims whitespace', () => {
    expect(normalizeWebsiteUrl('  https://example.com/a  ')).toBe('https://example.com/a');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeWebsiteUrl('')).toBe('');
    expect(normalizeWebsiteUrl('   ')).toBe('');
  });

  it('accepts http and https', () => {
    expect(normalizeWebsiteUrl('http://example.com')).toBe('http://example.com');
    expect(normalizeWebsiteUrl('HTTPS://example.com')).toBe('HTTPS://example.com');
  });

  it('rejects non-http(s) schemes', () => {
    expect(() => normalizeWebsiteUrl('javascript:alert(1)')).toThrow();
    expect(() => normalizeWebsiteUrl('ftp://example.com')).toThrow();
  });

  it('does not silently prepend a scheme', () => {
    expect(() => normalizeWebsiteUrl('example.com')).toThrow();
  });

  it('rejects whitespace inside the URL', () => {
    expect(() => normalizeWebsiteUrl('https://exa mple.com')).toThrow();
  });

  it('rejects urls longer than 500 chars, accepts exactly 500', () => {
    const base = 'https://example.com/';
    expect(normalizeWebsiteUrl(base + 'a'.repeat(500 - base.length))).toHaveLength(500);
    expect(() => normalizeWebsiteUrl(base + 'a'.repeat(501 - base.length))).toThrow();
  });
});
