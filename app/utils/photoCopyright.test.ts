import { describe, it, expect } from 'vitest'
import { normalizeCopyright, COPYRIGHT_MAX_LENGTH } from './photoCopyright'

describe('normalizeCopyright', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeCopyright('  Max   Mustermann \n')).toBe('Max Mustermann')
  })

  it('returns null for empty, whitespace-only, null and undefined input', () => {
    expect(normalizeCopyright('')).toBeNull()
    expect(normalizeCopyright('   ')).toBeNull()
    expect(normalizeCopyright(null)).toBeNull()
    expect(normalizeCopyright(undefined)).toBeNull()
  })

  it('strips a leading © / (c) the user typed, since the overlay adds its own', () => {
    expect(normalizeCopyright('© Max')).toBe('Max')
    expect(normalizeCopyright('(c) Max')).toBe('Max')
    expect(normalizeCopyright('(C)Max')).toBe('Max')
    expect(normalizeCopyright('©')).toBeNull()
  })

  it('caps the length at the DB limit', () => {
    expect(normalizeCopyright('x'.repeat(250))).toHaveLength(COPYRIGHT_MAX_LENGTH)
  })
})
