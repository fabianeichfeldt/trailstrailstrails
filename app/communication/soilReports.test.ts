import { describe, it, expect, vi, afterEach } from 'vitest'
import { FUNCTIONS } from './http'
import { submitSoilReport, type SoilReport } from './soilReports'

const REPORT: SoilReport = {
  spotType: 'trail',
  spotId: 't1',
  observedAt: '2026-09-25T10:00:00.000Z',
  rangeLo: 1,
  rangeHi: 2,
  flags: ['raining'],
}

const realFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = realFetch })

function respond(status: number, body: unknown = { ok: true }) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
}

describe('submitSoilReport', () => {
  it('POSTs exactly the report fields to soil-report with the user token', async () => {
    const fetchMock = respond(200)
    vi.stubGlobal('fetch', fetchMock)

    const result = await submitSoilReport(
      { ...REPORT, user_id: 'x', adjusted: true, model_lo: 0 } as SoilReport,
      'jwt-1',
    )

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${FUNCTIONS}/soil-report`)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer jwt-1')
    expect(JSON.parse(init.body)).toEqual({
      spotType: 'trail',
      spotId: 't1',
      observedAt: '2026-09-25T10:00:00.000Z',
      rangeLo: 1,
      rangeHi: 2,
      flags: ['raining'],
    })
  })

  it('maps 422 no_soil_verdict to its own error', async () => {
    vi.stubGlobal('fetch', respond(422, { error: 'no_soil_verdict' }))
    expect(await submitSoilReport(REPORT, 't')).toEqual({ ok: false, error: 'no_soil_verdict' })
  })

  it.each([400, 401, 404, 405, 500, 502])('maps %i to a generic failure', async (status) => {
    vi.stubGlobal('fetch', respond(status, { error: 'nope' }))
    expect(await submitSoilReport(REPORT, 't')).toEqual({ ok: false, error: 'failed' })
  })

  it('treats a 422 with any other error as a generic failure', async () => {
    vi.stubGlobal('fetch', respond(422, { error: 'something_else' }))
    expect(await submitSoilReport(REPORT, 't')).toEqual({ ok: false, error: 'failed' })
  })

  it('never throws: a network error or unreadable body is a generic failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await submitSoilReport(REPORT, 't')).toEqual({ ok: false, error: 'failed' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => { throw new Error('bad json') } }))
    expect(await submitSoilReport(REPORT, 't')).toEqual({ ok: false, error: 'failed' })
  })
})
