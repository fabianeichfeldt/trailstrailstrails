import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendContactMessage } from './contact'

const BASE_URL = 'https://test.supabase.co'
const MSG = { name: 'Rita', email: 'rita@example.com', message: 'Hallo, eine Frage zum Trail.', website: '' }

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }))
}

afterEach(() => vi.unstubAllGlobals())

describe('sendContactMessage', () => {
  it('POSTs the message with anon headers to the contact function', async () => {
    const fetch = vi.fn().mockReturnValue(respond(200, { ok: true }))
    vi.stubGlobal('fetch', fetch)
    await sendContactMessage(MSG)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(`${BASE_URL}/functions/v1/contact`)
    expect(init.method).toBe('POST')
    expect(init.headers.apikey).toBeTruthy()
    expect(JSON.parse(init.body)).toEqual(MSG)
  })

  it('resolves ok on 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(200, { ok: true })))
    await expect(sendContactMessage(MSG)).resolves.toEqual({ ok: true })
  })

  it('names the invalid field on 400', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(400, { error: 'invalid', field: 'email' })))
    await expect(sendContactMessage(MSG)).resolves.toEqual({ ok: false, error: 'invalid', field: 'email' })
  })

  it('maps any other failure, incl. a network error, to unknown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(502, { error: 'send_failed' })))
    await expect(sendContactMessage(MSG)).resolves.toEqual({ ok: false, error: 'unknown' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(sendContactMessage(MSG)).resolves.toEqual({ ok: false, error: 'unknown' })
  })
})
