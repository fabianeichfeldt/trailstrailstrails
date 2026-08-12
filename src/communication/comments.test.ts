import { describe, it, expect, vi, afterEach } from 'vitest'
import { getComments, getOlderComments, postComment, deleteComment } from './comments'
import type { IAuthService } from '../auth/auth_service'
import { User } from '../auth/user'

function ok(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

function err(status: number, body: unknown = { message: 'error' }) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  })
}

afterEach(() => vi.unstubAllGlobals())

function fakeAuth(overrides: Partial<User> = {}): IAuthService {
  const user = new User('u1', 'a@b.com', 'Alice', 'token-123')
  Object.assign(user, overrides)
  return {
    loggedIn: true,
    getUser: () => Promise.resolve(user),
  } as IAuthService
}

// ── getComments ─────────────────────────────────────────────────────────────

describe('getComments', () => {
  it('requests the latest page ordered newest-first with the profiles join', async () => {
    const fetch = vi.fn().mockReturnValue(ok([]))
    vi.stubGlobal('fetch', fetch)
    await getComments('s1')
    const url: string = fetch.mock.calls[0][0]
    expect(url).toContain('/spot_comments?')
    expect(url).toContain('spot_id=eq.s1')
    expect(url).toContain('order=created_at.desc')
    expect(url).toContain('limit=20')
    expect(url).toContain('profiles(display_name,avatar_url)')
  })

  it('returns the parsed comments on success', async () => {
    const rows = [{ id: 1, spot_id: 's1', comment_text: 'hi' }]
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok(rows)))
    const result = await getComments('s1')
    expect(result).toEqual(rows)
  })

  it('returns an empty array when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(500)))
    const result = await getComments('s1')
    expect(result).toEqual([])
  })
})

// ── getOlderComments ────────────────────────────────────────────────────────

describe('getOlderComments', () => {
  it('applies a created_at cursor filter', async () => {
    const fetch = vi.fn().mockReturnValue(ok([]))
    vi.stubGlobal('fetch', fetch)
    await getOlderComments('s1', '2026-08-01T00:00:00Z')
    const url: string = fetch.mock.calls[0][0]
    expect(url).toContain('created_at=lt.')
    expect(url).toContain(encodeURIComponent('2026-08-01T00:00:00Z'))
  })
})

// ── postComment ─────────────────────────────────────────────────────────────

describe('postComment', () => {
  it('posts spot_id, user_id and comment_text using the auth service token', async () => {
    const fetch = vi.fn().mockReturnValue(ok([{ id: 5, spot_id: 's1', user_id: 'u1', comment_text: 'nice trail', created_at: 'now' }]))
    vi.stubGlobal('fetch', fetch)
    await postComment('s1', 'nice trail', fakeAuth())

    const [url, opts] = fetch.mock.calls[0]
    expect(url).toContain('/spot_comments')
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer token-123')
    expect(JSON.parse(opts.body)).toEqual({ spot_id: 's1', user_id: 'u1', comment_text: 'nice trail' })
  })

  it('returns the inserted comment with the current user attached as profiles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(
      ok([{ id: 5, spot_id: 's1', user_id: 'u1', comment_text: 'nice trail', created_at: 'now' }]),
    ))
    const result = await postComment('s1', 'nice trail', fakeAuth({ nickname: 'Alice', avatarUrl: 'a.png' }))
    expect(result.profiles).toEqual({ display_name: 'Alice', avatar_url: 'a.png' })
  })

  it('throws the server message on failure (e.g. rate limit)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(429, { message: 'Bitte warte kurz, bevor du erneut kommentierst.' })))
    await expect(postComment('s1', 'spam', fakeAuth())).rejects.toThrow('Bitte warte kurz')
  })
})

// ── deleteComment ───────────────────────────────────────────────────────────

describe('deleteComment', () => {
  it('sends a DELETE filtered by id using the auth service token', async () => {
    const fetch = vi.fn().mockReturnValue(ok({}))
    vi.stubGlobal('fetch', fetch)
    await deleteComment(5, fakeAuth())

    const [url, opts] = fetch.mock.calls[0]
    expect(url).toContain('/spot_comments?id=eq.5')
    expect(opts.method).toBe('DELETE')
    expect(opts.headers.Authorization).toBe('Bearer token-123')
  })

  it('throws on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(403, { message: 'not allowed' })))
    await expect(deleteComment(5, fakeAuth())).rejects.toThrow('not allowed')
  })
})
