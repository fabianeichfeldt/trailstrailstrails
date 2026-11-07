import { describe, it, expect, vi, afterEach } from 'vitest'
import { share } from './share'

afterEach(() => vi.unstubAllGlobals())

describe('share', () => {
  it('POSTs to the share endpoint with the trail id in the query', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await share('trail-42')
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://trailradar.org/api/share?id=trail-42')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('URL-encodes the trail id so reserved characters cannot change the query', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await share('a b/c?d')
    const [url] = fetch.mock.calls[0]
    expect(url).toBe('https://trailradar.org/api/share?id=a%20b%2Fc%3Fd')
  })
})
