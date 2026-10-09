import { describe, it, expect, vi, afterEach } from 'vitest'
import { deleteAccount } from './account'

function res(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

afterEach(() => vi.unstubAllGlobals())

function stub(r: Promise<unknown>) {
  const fetch = vi.fn().mockReturnValue(r)
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('deleteAccount', () => {
  it('posts to the delete-account function with the bearer token', async () => {
    const fetch = stub(res(200, { ok: true }))

    const r = await deleteAccount('jwt-1')

    const [url, opts] = fetch.mock.calls[0]
    expect(url).toMatch(/\/functions\/v1\/delete-account$/)
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe('Bearer jwt-1')
    expect(r).toEqual({ ok: true })
  })

  it('maps 409 active_subscription and 403 admin', async () => {
    stub(res(409, { error: 'active_subscription' }))
    expect(await deleteAccount('j')).toEqual({ ok: false, error: 'active_subscription' })
    stub(res(403, { error: 'admin' }))
    expect(await deleteAccount('j')).toEqual({ ok: false, error: 'admin' })
  })

  it('maps 500, 401, an unexpected 200 body and a network error to unknown', async () => {
    stub(res(500, { error: 'delete_failed' }))
    expect(await deleteAccount('j')).toEqual({ ok: false, error: 'unknown' })
    stub(res(401, { error: 'unauthorized' }))
    expect(await deleteAccount('j')).toEqual({ ok: false, error: 'unknown' })
    stub(res(200, {}))
    expect(await deleteAccount('j')).toEqual({ ok: false, error: 'unknown' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await deleteAccount('j')).toEqual({ ok: false, error: 'unknown' })
  })
})
