import { describe, it, expect } from 'vitest'
import { authorName, DELETED_USER } from './authorName'

describe('authorName', () => {
  it('returns the display name when present', () => {
    expect(authorName({ display_name: 'Alice' }, 'Anonym')).toBe('Alice')
  })

  it('falls back when the profile has no display name', () => {
    expect(authorName({ display_name: '' }, 'Anonym')).toBe('Anonym')
  })

  it('marks a null profile (author deleted their account) as deleted', () => {
    expect(authorName(null, 'Anonym')).toBe(DELETED_USER)
  })

  it('does not mark a profile that was never loaded as deleted', () => {
    expect(authorName(undefined)).toBe('')
  })
})
