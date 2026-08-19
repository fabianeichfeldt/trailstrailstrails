import { describe, it, expect, vi, afterEach } from 'vitest'
import { submitBetaSignup } from './betaSignup'

const REST_URL = 'https://test.supabase.co/rest/v1'

function ok() {
  return Promise.resolve({
    ok: true,
    status: 201,
    text: () => Promise.resolve(''),
  })
}

function conflict() {
  return Promise.resolve({
    ok: false,
    status: 409,
    text: () => Promise.resolve('duplicate key value violates unique constraint'),
  })
}

function err(status: number, text = 'error') {
  return Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve(text),
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('submitBetaSignup', () => {
  it('POSTs name and email to the beta_signups table', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitBetaSignup('Jamie', 'jamie@example.com')
    expect(fetch.mock.calls[0][0]).toBe(`${REST_URL}/beta_signups`)
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body).toEqual({ name: 'Jamie', email: 'jamie@example.com' })
  })

  it('sends the anon Authorization header', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitBetaSignup('Jamie', 'jamie@example.com')
    expect(fetch.mock.calls[0][1].headers['Authorization']).toMatch(/^Bearer ey/)
  })

  it('resolves to undefined on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok()))
    await expect(submitBetaSignup('Jamie', 'jamie@example.com')).resolves.toBeUndefined()
  })

  it('throws a DUPLICATE_EMAIL error on 409', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(conflict()))
    await expect(submitBetaSignup('Jamie', 'jamie@example.com')).rejects.toThrow('DUPLICATE_EMAIL')
  })

  it('throws a generic error with the status on other failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(500, 'server error')))
    await expect(submitBetaSignup('Jamie', 'jamie@example.com')).rejects.toThrow('500')
  })
})
