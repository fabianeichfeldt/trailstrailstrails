import { describe, it, expect } from 'vitest'
import { canDeletePhoto, type PhotoPermissionContext } from './canDeletePhoto'

function ctx(overrides: Partial<PhotoPermissionContext> = {}): PhotoPermissionContext {
  return { userId: 'u1', isAdmin: false, photosCanModerate: false, ...overrides }
}

describe('canDeletePhoto', () => {
  it('returns true when the photo creator matches the current user', () => {
    expect(canDeletePhoto({ creator: 'u1' }, ctx({ userId: 'u1' }))).toBe(true)
  })

  it('returns true for admin regardless of creator/userId', () => {
    expect(canDeletePhoto({ creator: 'someone-else' }, ctx({ userId: 'u1', isAdmin: true }))).toBe(true)
  })

  it('returns true when photosCanModerate is set, regardless of creator/userId', () => {
    expect(canDeletePhoto({ creator: 'someone-else' }, ctx({ userId: 'u1', photosCanModerate: true }))).toBe(true)
  })

  it('returns false when none of the three apply', () => {
    expect(canDeletePhoto({ creator: 'someone-else' }, ctx({ userId: 'u1' }))).toBe(false)
  })

  it('returns false when photo.creator is missing/empty, even if ctx.userId is also empty', () => {
    expect(canDeletePhoto({ creator: '' }, ctx({ userId: '' }))).toBe(false)
    expect(canDeletePhoto({}, ctx({ userId: '' }))).toBe(false)
  })
})
