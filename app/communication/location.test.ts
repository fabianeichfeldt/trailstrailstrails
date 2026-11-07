import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { getApproxLocation } from './location'

function geo(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getApproxLocation', () => {
  it('requests the geo endpoint', async () => {
    const fetch = geo(200, { lat: 48.1351, lon: 11.582 })
    vi.stubGlobal('fetch', fetch)
    await getApproxLocation()
    expect(fetch.mock.calls[0][0]).toBe('https://trailradar.org/geo')
  })

  it('rounds coordinates to one decimal place', async () => {
    vi.stubGlobal('fetch', geo(200, { lat: 48.1351, lon: 11.582 }))
    await expect(getApproxLocation()).resolves.toEqual({ lat: 48.1, lng: 11.6 })
  })

  it('falls back to 0/0 when the response is not ok', async () => {
    vi.stubGlobal('fetch', geo(503, { lat: 48.1, lon: 11.5 }))
    await expect(getApproxLocation()).resolves.toEqual({ lat: 0, lng: 0 })
  })

  it('falls back to 0/0 when the payload has no coordinates', async () => {
    vi.stubGlobal('fetch', geo(200, { country: 'DE' }))
    await expect(getApproxLocation()).resolves.toEqual({ lat: 0, lng: 0 })
  })

  it('falls back to 0/0 on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(getApproxLocation()).resolves.toEqual({ lat: 0, lng: 0 })
  })
})
