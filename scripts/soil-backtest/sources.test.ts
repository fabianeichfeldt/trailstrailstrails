import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSoilGridsUrl,
  parseSoilGridsLayers,
  fetchSoilProfile,
  fetchSoilProfileNear,
  NoSoilDataError,
  fetchJsonWithRetry,
  buildHistoryUrl,
  fetchHistory,
  MOISTURE_LAYERS,
  SOIL_PROPERTY_GROUPS,
  type FetchDeps,
} from './sources'

// Real SoilGrids responses for Bärenleite (49.9128, 11.5604), 5-15 cm — captured
// from rest.isric.org so the parser is tested against the actual shape.
const fixture = (name: string) => JSON.parse(readFileSync(resolve(__dirname, '__fixtures__', name), 'utf8'))
const TEXTURE = fixture('soilgrids-texture.json')
const STONES_CARBON = fixture('soilgrids-stones-carbon.json')
const WATER = fixture('soilgrids-water.json')

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}
function statusResponse(status: number) {
  return { ok: false, status, json: async () => ({}) } as unknown as Response
}
function deps(fetchImpl: FetchDeps['fetch']): FetchDeps & { sleep: ReturnType<typeof vi.fn> } {
  return { fetch: fetchImpl, sleep: vi.fn().mockResolvedValue(undefined) }
}

describe('buildSoilGridsUrl', () => {
  it('asks for the given properties at the trail-bed depth, at the given point', () => {
    const url = buildSoilGridsUrl(49.9128, 11.5604, ['cfvo', 'soc'], false)

    expect(url).toContain('https://rest.isric.org/soilgrids/v2.0/properties/query')
    expect(url).toContain('lat=49.9128')
    expect(url).toContain('lon=11.5604')
    expect(url).toContain('property=cfvo')
    expect(url).toContain('property=soc')
    expect(url).toContain('depth=5-15cm')
    expect(url).toContain('value=mean')
    expect(url).not.toContain('Q0.05')
  })

  it('adds the 5% / 95% bounds when uncertainty is wanted', () => {
    const url = buildSoilGridsUrl(49.9128, 11.5604, ['clay'], true)

    expect(url).toContain('value=Q0.05')
    expect(url).toContain('value=Q0.95')
  })

  it('splits the properties into small requests — the full set timed out in one call', () => {
    // 8 properties with uncertainty bounds hit a 90 s timeout; groups of <= 3 answered in ~3 s.
    expect(SOIL_PROPERTY_GROUPS.every((g) => g.length <= 3)).toBe(true)
    expect(SOIL_PROPERTY_GROUPS.flat().sort()).toEqual(
      ['clay', 'cfvo', 'silt', 'sand', 'soc', 'wv0010', 'wv0033', 'wv1500'].sort(),
    )
  })
})

describe('parseSoilGridsLayers', () => {
  it('converts SoilGrids integer units into the values they stand for', () => {
    const layers = parseSoilGridsLayers(TEXTURE)

    // The API returns g/kg * 10 style integers; d_factor 10 turns 244 into 24.4 %.
    expect(layers.get('clay')!.mean).toBeCloseTo(24.4, 1)
    expect(layers.get('sand')!.mean).toBeCloseTo(33.3, 1)
    expect(layers.get('silt')!.mean).toBeCloseTo(42.2, 1)
  })

  it('keeps the uncertainty bounds — at Bärenleite clay is anywhere from ~1% to ~75%', () => {
    const clay = parseSoilGridsLayers(TEXTURE).get('clay')!

    expect(clay.q05).toBeCloseTo(1.3, 1)
    expect(clay.q95).toBeCloseTo(75.3, 1)
  })

  it('returns null bounds when they were not requested', () => {
    const cfvo = parseSoilGridsLayers(STONES_CARBON).get('cfvo')!

    expect(cfvo.mean).toBeCloseTo(13, 0)
    expect(cfvo.q05).toBeNull()
    expect(cfvo.q95).toBeNull()
  })

  it('rejects a response that is not a SoilGrids feature', () => {
    expect(() => parseSoilGridsLayers({ detail: 'Internal error' })).toThrow(/SoilGrids/)
  })
})

describe('fetchSoilProfile', () => {
  const route = (url: string) => {
    if (url.includes('property=clay')) return TEXTURE
    if (url.includes('property=cfvo')) return STONES_CARBON
    if (url.includes('property=wv0010')) return WATER
    throw new Error(`unexpected url ${url}`)
  }

  it('assembles one profile from the three grouped requests, water in m³/m³', async () => {
    const d = deps(vi.fn(async (url: string) => okResponse(route(url))) as unknown as FetchDeps['fetch'])

    const profile = await fetchSoilProfile(49.9128, 11.5604, d, { pauseMs: 0 })

    expect(profile.clay).toBeCloseTo(24.4, 1)
    expect(profile.clayQ05).toBeCloseTo(1.3, 1)
    expect(profile.clayQ95).toBeCloseTo(75.3, 1)
    expect(profile.cfvo).toBeCloseTo(13, 0)
    expect(profile.soc).toBeCloseTo(26.7, 1)
    // 34.2 vol-% field capacity and 17.8 vol-% wilting point, as fractions.
    expect(profile.wv0033).toBeCloseTo(0.342, 3)
    expect(profile.wv1500).toBeCloseTo(0.178, 3)
    expect(profile.wv0010).toBeCloseTo(0.423, 3)
    expect(d.fetch).toHaveBeenCalledTimes(3)
  })

  it('pauses between the requests so it stays polite to a beta service', async () => {
    const d = deps(vi.fn(async (url: string) => okResponse(route(url))) as unknown as FetchDeps['fetch'])

    await fetchSoilProfile(49.9128, 11.5604, d, { pauseMs: 750 })

    expect(d.sleep).toHaveBeenCalledWith(750)
    expect(d.sleep).toHaveBeenCalledTimes(2) // between 3 requests, not after the last
  })

  it('fails loudly when a property is missing instead of producing a half-empty profile', async () => {
    const d = deps(vi.fn(async () => okResponse(TEXTURE)) as unknown as FetchDeps['fetch']) // every group gets texture only

    await expect(fetchSoilProfile(49.9128, 11.5604, d, { pauseMs: 0 })).rejects.toThrow(/cfvo|soc|wv/)
  })
})

// Real SoilGrids answer for a masked pixel (Kulmbach town centre, 50.1111 / 11.4606):
// the layers are there, every mean is null.
const MASKED = {
  type: 'Feature',
  properties: {
    layers: ['clay', 'sand', 'silt'].map((name) => ({
      name,
      unit_measure: { d_factor: 10 },
      depths: [{ label: '5-15cm', values: { mean: null } }],
    })),
  },
}

describe('fetchSoilProfileNear', () => {
  const at = (url: string, lat: number, lon: number) =>
    Math.abs(Number(new URL(url).searchParams.get('lat')) - lat) < 1e-9 &&
    Math.abs(Number(new URL(url).searchParams.get('lon')) - lon) < 1e-9

  it('reports a masked pixel as "no soil data here", not as a half-empty profile', async () => {
    const d = deps(vi.fn(async () => okResponse(MASKED)) as unknown as FetchDeps['fetch'])

    await expect(fetchSoilProfile(50.1111, 11.4606, d, { pauseMs: 0 })).rejects.toBeInstanceOf(NoSoilDataError)
    // It gave up after the texture group instead of spending two more calls on a pixel with no soil.
    expect(d.fetch).toHaveBeenCalledTimes(1)
  })

  it('falls back to a neighbouring point when the exact one is masked, and says how far it looked', async () => {
    const seen: string[] = []
    const fetchImpl = vi.fn(async (url: string) => {
      seen.push(url)
      // Masked at the spot itself, real data everywhere else.
      if (at(url, 50.1111, 11.4606)) return okResponse(MASKED)
      if (url.includes('property=clay')) return okResponse(TEXTURE)
      if (url.includes('property=cfvo')) return okResponse(STONES_CARBON)
      return okResponse(WATER)
    })
    const d = deps(fetchImpl as unknown as FetchDeps['fetch'])

    const profile = await fetchSoilProfileNear(50.1111, 11.4606, d, { pauseMs: 0 })

    expect(profile.clay).toBeCloseTo(24.4, 1)
    expect(profile.offsetMetres).toBeGreaterThan(0)
    expect(profile.offsetMetres).toBeLessThanOrEqual(600)
  })

  it('does not move at all when the exact point has data', async () => {
    const route = (url: string) =>
      url.includes('property=clay') ? TEXTURE : url.includes('property=cfvo') ? STONES_CARBON : WATER
    const d = deps(vi.fn(async (url: string) => okResponse(route(url))) as unknown as FetchDeps['fetch'])

    const profile = await fetchSoilProfileNear(49.9128, 11.5604, d, { pauseMs: 0 })

    expect(profile.offsetMetres).toBe(0)
    expect(d.fetch).toHaveBeenCalledTimes(3)
  })

  it('gives up with a clear error when nothing nearby has soil either', async () => {
    const d = deps(vi.fn(async () => okResponse(MASKED)) as unknown as FetchDeps['fetch'])

    await expect(fetchSoilProfileNear(50.1111, 11.4606, d, { pauseMs: 0 })).rejects.toThrow(/no soil data/i)
  })
})

describe('fetchJsonWithRetry', () => {
  it('retries a 429 with growing backoff and then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(statusResponse(429))
      .mockResolvedValueOnce(statusResponse(503))
      .mockResolvedValueOnce(okResponse({ ok: 1 }))
    const d = deps(fetchImpl)

    const result = await fetchJsonWithRetry('https://example.test/x', d, { retries: 3, baseDelayMs: 1000 })

    expect(result).toEqual({ ok: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(d.sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000])
  })

  it('retries a network error too', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(okResponse([1]))

    const result = await fetchJsonWithRetry('https://example.test/x', deps(fetchImpl), { retries: 2, baseDelayMs: 1 })

    expect(result).toEqual([1])
  })

  it('gives up after the last retry and says which status it ended on', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(statusResponse(503))

    await expect(
      fetchJsonWithRetry('https://example.test/x', deps(fetchImpl), { retries: 2, baseDelayMs: 1 }),
    ).rejects.toThrow(/503/)
    expect(fetchImpl).toHaveBeenCalledTimes(3) // first try + 2 retries
  })

  it('does not retry a client error — a 404 will not get better', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(statusResponse(404))

    await expect(
      fetchJsonWithRetry('https://example.test/x', deps(fetchImpl), { retries: 3, baseDelayMs: 1 }),
    ).rejects.toThrow(/404/)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('buildHistoryUrl / fetchHistory', () => {
  it('requests 92 days of hourly rain and every soil-moisture layer, plus what the model needs', () => {
    const url = buildHistoryUrl(49.9128, 11.5604)

    expect(url).toContain('https://api.open-meteo.com/v1/forecast')
    expect(url).toContain('past_days=92')
    expect(url).toContain('forecast_days=1')
    expect(url).toContain('timezone=auto')
    for (const layer of MOISTURE_LAYERS) expect(url).toContain(layer)
    expect(url).toContain('precipitation')
    // The real model reads daily et0, current conditions and snowfall.
    expect(url).toContain('et0_fao_evapotranspiration')
    expect(url).toContain('current=')
    expect(url).toContain('snowfall')
  })

  it('returns the parsed body', async () => {
    const d = deps(vi.fn(async () => okResponse({ hourly: {} })) as unknown as FetchDeps['fetch'])

    await expect(fetchHistory(49.9128, 11.5604, d)).resolves.toEqual({ hourly: {} })
  })
})
