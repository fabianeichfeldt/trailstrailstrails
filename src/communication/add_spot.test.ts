import { describe, it, expect, vi, afterEach } from 'vitest'
import { submitSpot, type AddSpotPayload } from './add_spot'

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

const JWT = 'test-jwt'

const TRAIL_PAYLOAD: AddSpotPayload = {
  type: 'trail',
  name: 'Flowtrail Süd',
  latitude: 47.71,
  longitude: 11.76,
}

const DIRTPARK_PAYLOAD: AddSpotPayload = {
  type: 'dirtpark',
  name: 'Pumptrack Süd',
  latitude: 48.14,
  longitude: 11.57,
  pumptrack: true,
  dirtpark: false,
}

afterEach(() => vi.unstubAllGlobals())

// ── submitSpot — HTTP mechanics ───────────────────────────────────────────────

describe('submitSpot — HTTP mechanics', () => {
  it('POSTs to the trail edge function URL', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot(TRAIL_PAYLOAD, JWT)
    expect(fetch.mock.calls[0][0]).toBe(`${BASE_URL}/functions/v1/add-trail`)
    expect(fetch.mock.calls[0][1].method).toBe('POST')
  })

  it('POSTs to the bikepark edge function URL', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot({ ...TRAIL_PAYLOAD, type: 'bikepark' }, JWT)
    expect(fetch.mock.calls[0][0]).toBe(`${BASE_URL}/functions/v1/bike-parks`)
  })

  it('POSTs to the dirtpark edge function URL', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot(DIRTPARK_PAYLOAD, JWT)
    expect(fetch.mock.calls[0][0]).toBe(`${BASE_URL}/functions/v1/dirt-parks`)
  })

  it('sends Content-Type: application/json', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot(TRAIL_PAYLOAD, JWT)
    expect(fetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json')
  })

  it('sends Authorization header with the anon key', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot(TRAIL_PAYLOAD, JWT)
    expect(fetch.mock.calls[0][1].headers['Authorization']).toMatch(/^Bearer ey/)
  })

  it('resolves to undefined on a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok()))
    await expect(submitSpot(TRAIL_PAYLOAD, JWT)).resolves.toBeUndefined()
  })

  it('throws with status code on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(422, 'validation error')))
    await expect(submitSpot(TRAIL_PAYLOAD, JWT)).rejects.toThrow('422')
  })

  it('throws on server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(err(500, 'server error')))
    await expect(submitSpot(TRAIL_PAYLOAD, JWT)).rejects.toThrow('500')
  })
})

// ── submitSpot — request body ─────────────────────────────────────────────────

describe('submitSpot — request body', () => {
  it('includes name, latitude, longitude but NOT type', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot(TRAIL_PAYLOAD, JWT)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.type).toBeUndefined()
    expect(body.name).toBe('Flowtrail Süd')
    expect(body.latitude).toBe(47.71)
    expect(body.longitude).toBe(11.76)
  })

  it('includes url when provided', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot({ ...TRAIL_PAYLOAD, url: 'https://example.com' }, JWT)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.url).toBe('https://example.com')
  })

  it('omits url when not provided', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot(TRAIL_PAYLOAD, JWT)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.url).toBeUndefined()
  })

  it('includes creator_id when provided', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot({ ...TRAIL_PAYLOAD, creator_id: 'user-uuid-123' }, JWT)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.creator_id).toBe('user-uuid-123')
  })
})

// ── submitSpot — dirtpark-specific fields ─────────────────────────────────────

describe('submitSpot — dirtpark-specific fields', () => {
  it('includes pumptrack and dirtpark flags for dirtpark type', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot(DIRTPARK_PAYLOAD, JWT)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.pumptrack).toBe(true)
    expect(body.dirtpark).toBe(false)
  })

  it('dirtpark payload can set both flags to true', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot({ ...DIRTPARK_PAYLOAD, pumptrack: true, dirtpark: true }, JWT)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.pumptrack).toBe(true)
    expect(body.dirtpark).toBe(true)
  })

  it('trail type does not include pumptrack or dirtpark', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot(TRAIL_PAYLOAD, JWT)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.pumptrack).toBeUndefined()
    expect(body.dirtpark).toBeUndefined()
  })

  it('bikepark type does not include pumptrack or dirtpark', async () => {
    const bikeparkPayload: AddSpotPayload = { type: 'bikepark', name: 'Bikepark Nord', latitude: 47.68, longitude: 11.56 }
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot(bikeparkPayload, JWT)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.pumptrack).toBeUndefined()
    expect(body.dirtpark).toBeUndefined()
  })
})

// ── submitSpot — validation ───────────────────────────────────────────────────

describe('submitSpot — validation', () => {
  it('throws when name is empty string', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(submitSpot({ ...TRAIL_PAYLOAD, name: '' }, JWT)).rejects.toThrow('Name ist erforderlich')
  })

  it('throws when name is only whitespace', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(submitSpot({ ...TRAIL_PAYLOAD, name: '   ' }, JWT)).rejects.toThrow('Name ist erforderlich')
  })

  it('does not call fetch when validation fails', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await submitSpot({ ...TRAIL_PAYLOAD, name: '' }, JWT).catch(() => {})
    expect(fetch).not.toHaveBeenCalled()
  })

  it('accepts a name with leading/trailing whitespace and sends it as-is', async () => {
    const fetch = vi.fn().mockReturnValue(ok())
    vi.stubGlobal('fetch', fetch)
    await submitSpot({ ...TRAIL_PAYLOAD, name: '  Flowtrail  ' }, JWT)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.name).toBe('  Flowtrail  ')
  })
})
