import { describe, expect, it } from 'vitest'
import { User } from './user'

describe('User', () => {
  it('stores constructor fields', () => {
    const u = new User('id1', 'a@b.de', 'Nick', 'tok', 'http://av/x.png')
    expect(u).toMatchObject({ id: 'id1', email: 'a@b.de', nickname: 'Nick', accessToken: 'tok', avatarUrl: 'http://av/x.png' })
  })

  it('renders an <img> avatar when an avatarUrl is given', () => {
    const u = new User('1', 'a@b.de', 'N', 't', 'http://av/x.png')
    expect(u.avatarHTML).toContain('<img src="http://av/x.png" alt="User Avatar" />')
    expect(u.avatarHTML).not.toContain('avatar-fallback')
  })

  it('renders the fallback avatar without a url', () => {
    const u = new User('1', 'a@b.de', 'N', 't')
    expect(u.avatarHTML).toContain('<span class="avatar-fallback" aria-hidden="true"></span>')
    expect(u.avatarHTML).not.toContain('<img')
    expect(u.avatarHTML).toContain('class="user-avatar"')
  })

  it('exposes an anonymous user with id -1', () => {
    expect(User.AnonymousUser.id).toBe('-1')
  })
})
