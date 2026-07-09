import { describe, it, expect, vi, afterEach } from 'vitest'
import { submitReport } from './report'

const BASE_URL = 'https://test.supabase.co'

function ok() {
  return Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
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

describe('submitReport — HTTP mechanics', () => {
  it('POSTs to the report edge function URL', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitReport('trail-1', 'Flowtrail Süd', 'Der Trail ist gesperrt.')
    expect(fetch.mock.calls[0][0]).toBe(`${BASE_URL}/functions/v1/report`)
    expect(fetch.mock.calls[0][1].method).toBe('POST')
  })

  it('sends anonHeaders (Content-Type + apikey + Authorization with anon key)', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitReport('trail-1', 'Flowtrail Süd', 'Der Trail ist gesperrt.')
    const headers = fetch.mock.calls[0][1].headers
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Authorization']).toMatch(/^Bearer /)
    expect(headers['apikey']).toBeTruthy()
  })

  it('resolves to undefined on a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok()))
    await expect(submitReport('trail-1', 'Flowtrail Süd', 'Hinweis')).resolves.toBeUndefined()
  })

  it('throws with status + body text on a server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(500, 'server exploded')))
    await expect(submitReport('trail-1', 'Flowtrail Süd', 'Hinweis'))
      .rejects.toThrow('500')
  })

  it('throws on a 4xx response too', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(422, 'validation error')))
    await expect(submitReport('trail-1', 'Flowtrail Süd', 'Hinweis'))
      .rejects.toThrow('422')
  })
})

describe('submitReport — request body', () => {
  it('includes trail_id, trail_name, message', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitReport('trail-1', 'Flowtrail Süd', 'Der Trail ist gesperrt.')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.trail_id).toBe('trail-1')
    expect(body.trail_name).toBe('Flowtrail Süd')
    expect(body.message).toBe('Der Trail ist gesperrt.')
  })

  it('includes user_id when the reporter is logged in', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitReport('trail-1', 'Flowtrail Süd', 'Hinweis', 'user-uuid-123')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.user_id).toBe('user-uuid-123')
  })

  it('omits the user_id key entirely when the reporter is anonymous', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitReport('trail-1', 'Flowtrail Süd', 'Hinweis')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect('user_id' in body).toBe(false)
  })
})
