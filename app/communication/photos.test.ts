import { describe, it, expect, vi, afterEach } from 'vitest'
import { deletePhoto, isSpotAssignedToTrailcrew } from './photos'
import type { IAuthService } from '../auth/auth_service'
import { User } from '../auth/user'

afterEach(() => vi.unstubAllGlobals())

// ── deletePhoto ──────────────────────────────────────────────────────────

function fakeClient(opts: { deleteData?: unknown[] | null; deleteError?: unknown; removeError?: unknown } = {}) {
  const select = vi.fn().mockResolvedValue({ data: opts.deleteData ?? [{ id: 1 }], error: opts.deleteError ?? null })
  const eq = vi.fn(() => ({ select }))
  const del = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ delete: del }))
  const remove = vi.fn().mockResolvedValue({ error: opts.removeError ?? null })
  const storage = { from: vi.fn(() => ({ remove })) }
  return { client: { from, storage } as any, del, eq, select, remove, storage }
}

describe('deletePhoto', () => {
  it('deletes the row then removes the derived storage path on the happy path', async () => {
    const { client, del, eq, remove, storage } = fakeClient()

    await deletePhoto({ id: 1, url: 'https://proj.supabase.co/storage/v1/object/public/trail-photos/t1/abc.webp' }, client)

    expect(del).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('id', 1)
    expect(storage.from).toHaveBeenCalledWith('trail-photos')
    expect(remove).toHaveBeenCalledWith(['t1/abc.webp'])
  })

  it('throws when the row delete errors, and never calls storage.remove()', async () => {
    const { client, remove } = fakeClient({ deleteError: { message: 'boom' } })

    await expect(
      deletePhoto({ id: 1, url: 'https://x/trail-photos/t1/abc.webp' }, client),
    ).rejects.toThrow('Photo delete failed')
    expect(remove).not.toHaveBeenCalled()
  })

  it('throws when the row delete succeeds but returns zero rows (RLS-blocked)', async () => {
    const { client, remove } = fakeClient({ deleteData: [] })

    await expect(
      deletePhoto({ id: 1, url: 'https://x/trail-photos/t1/abc.webp' }, client),
    ).rejects.toThrow('not permitted')
    expect(remove).not.toHaveBeenCalled()
  })

  it('resolves without calling storage.remove() when the URL has no /trail-photos/ segment', async () => {
    const { client, remove } = fakeClient()

    await expect(deletePhoto({ id: 1, url: 'https://x/some-other-bucket/t1/abc.webp' }, client)).resolves.toBeUndefined()
    expect(remove).not.toHaveBeenCalled()
  })

  it('throws when storage.remove() errors after a successful row delete', async () => {
    const { client } = fakeClient({ removeError: { message: 'storage boom' } })

    await expect(
      deletePhoto({ id: 1, url: 'https://x/trail-photos/t1/abc.webp' }, client),
    ).rejects.toThrow('Photo file delete failed')
  })
})

// ── isSpotAssignedToTrailcrew ────────────────────────────────────────────

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

function fakeAuth(overrides: Partial<User> = {}): IAuthService {
  const user = new User('u1', 'a@b.com', 'Alice', 'token-123')
  Object.assign(user, overrides)
  return {
    loggedIn: true,
    getUser: () => Promise.resolve(user),
  } as IAuthService
}

describe('isSpotAssignedToTrailcrew', () => {
  it('returns true when the REST call comes back with one row', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([{ spot_id: 's1' }])))

    const result = await isSpotAssignedToTrailcrew('s1', fakeAuth())

    expect(result).toBe(true)
  })

  it('returns false when it comes back with an empty array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([])))

    const result = await isSpotAssignedToTrailcrew('s1', fakeAuth())

    expect(result).toBe(false)
  })

  it('returns false (not a throw) when the fetch response is !ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(500)))

    await expect(isSpotAssignedToTrailcrew('s1', fakeAuth())).resolves.toBe(false)
  })

  it('sends the request with the bearer token from authService.getUser()', async () => {
    const fetch = vi.fn().mockReturnValue(ok([]))
    vi.stubGlobal('fetch', fetch)

    await isSpotAssignedToTrailcrew('s1', fakeAuth({ accessToken: 'tok-abc' }))

    const [url, opts] = fetch.mock.calls[0]
    expect(url).toContain('/trailcrew_spots?')
    expect(url).toContain('user_id=eq.u1')
    expect(url).toContain('spot_id=eq.s1')
    expect(opts.headers.Authorization).toBe('Bearer tok-abc')
  })
})
