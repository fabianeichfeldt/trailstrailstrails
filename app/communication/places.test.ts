import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchPlaces } from './places'

function json(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
}

const MUNICH = { display_name: 'München, Bayern, Deutschland', lat: '48.13', lon: '11.57' }
const MUNICH_US = { display_name: 'Munich, North Dakota, USA', lat: '48.66', lon: '-98.83' }

afterEach(() => vi.unstubAllGlobals())

describe('searchPlaces', () => {
  it('queries Nominatim restricted to DACH first and returns those hits as-is', async () => {
    const fetch = vi.fn().mockReturnValue(json([MUNICH]))
    vi.stubGlobal('fetch', fetch)

    const result = await searchPlaces('München')

    expect(result).toEqual([MUNICH])
    expect(fetch).toHaveBeenCalledTimes(1)
    const url = fetch.mock.calls[0][0] as string
    expect(url).toContain('https://nominatim.openstreetmap.org/search')
    expect(url).toContain('countrycodes=de,at,ch')
    expect(url).toContain(`q=${encodeURIComponent('München')}`)
  })

  it('falls back to a worldwide query when the DACH query comes back empty', async () => {
    const fetch = vi.fn()
      .mockReturnValueOnce(json([]))
      .mockReturnValueOnce(json([MUNICH_US]))
    vi.stubGlobal('fetch', fetch)

    const result = await searchPlaces('Munich')

    expect(result).toEqual([MUNICH_US])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][0] as string).not.toContain('countrycodes')
  })

  it('returns an empty array when the geocoder rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(searchPlaces('Freiburg')).resolves.toEqual([])
  })

  it('returns an empty array when the geocoder answers with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: () => Promise.resolve([]) }))
    await expect(searchPlaces('Freiburg')).resolves.toEqual([])
  })

  it('tolerates a non-array body instead of blowing up the searchbar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(json({ error: 'nope' })))
    await expect(searchPlaces('Freiburg')).resolves.toEqual([])
  })
})
