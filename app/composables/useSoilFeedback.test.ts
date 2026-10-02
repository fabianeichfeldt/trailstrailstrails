import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import type { ConditionRange, TrailConditionResponse } from '~/types/Weather'

const getToken = vi.fn()
vi.stubGlobal('useAuthStore', () => ({ getToken }))

import { useSoilFeedback, DEBOUNCE_MS, toLocalInput } from './useSoilFeedback'

// Only the network boundary is faked: `fetch`, routed by URL.
const fetchMock = vi.fn()
const realFetch = globalThis.fetch

function verdictResponse(range: ConditionRange | null) {
  return {
    verdict: { level: range ? 'damp' : 'raining', headline: 'h', detail: 'd', rain10dMm: 1, range },
    rainRule: { raining: false, hoursSinceRain: 1 },
    current: { temperature: 1, apparentTemperature: 1, icon: 'x', windKmh: 1 },
    strip: [],
    fetchedAt: '2026-09-26T10:00:00.000Z',
  } satisfies TrailConditionResponse
}

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function mountComposable(initial: ConditionRange = { lo: 1, hi: 2 }) {
  let api!: ReturnType<typeof useSoilFeedback>
  const wrapper = mount(defineComponent({
    setup() {
      api = useSoilFeedback(() => ({ spotType: 'trail', spotId: 't1' }), initial)
      return () => h('div')
    },
  }))
  return { api, wrapper }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-26T10:30:45'))
  fetchMock.mockReset()
  getToken.mockReset().mockResolvedValue('jwt-abc')
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
})
afterEach(() => {
  globalThis.fetch = realFetch
  vi.useRealTimers()
})

describe('useSoilFeedback — picker window', () => {
  it('defaults to now (minute precision), max now, min now minus 3 days', () => {
    const { api } = mountComposable()
    expect(api.observedLocal.value).toBe('2026-09-26T10:30')
    expect(api.maxLocal).toBe('2026-09-26T10:30')
    expect(api.minLocal).toBe('2026-09-23T10:30')
  })

  it('toLocalInput formats local time as datetime-local expects', () => {
    expect(toLocalInput(new Date('2026-01-02T03:04:59'))).toBe('2026-01-02T03:04')
  })
})

describe('useSoilFeedback — selection', () => {
  it('starts on the model range, unchanged, and follows the tap rules', () => {
    const { api } = mountComposable({ lo: 1, hi: 2 })
    expect(api.range.value).toEqual({ lo: 1, hi: 2 })
    expect(api.changed.value).toBe(false)

    api.tap(3)
    expect(api.range.value).toEqual({ lo: 3, hi: 3 })
    expect(api.changed.value).toBe(true)

    api.tap(2)
    expect(api.range.value).toEqual({ lo: 2, hi: 3 })

    api.tap(2)
    api.tap(2)
    api.tap(3)
    api.tap(3)
    expect(api.range.value).toEqual({ lo: 1, hi: 2 })
  })

  it('a toggle alone counts as a change', () => {
    const { api } = mountComposable()
    api.raining.value = true
    expect(api.changed.value).toBe(true)
  })

  it('reaches the new last segment (index 4, wet) introduced by the dry level', () => {
    const { api } = mountComposable({ lo: 2, hi: 3 })
    api.tap(4)
    expect(api.range.value).toEqual({ lo: 4, hi: 4 })
    expect(api.changed.value).toBe(true)
  })
})

describe('useSoilFeedback — refetch for the picked time', () => {
  it('debounces, asks trail-condition with `at`, disables submit meanwhile and adopts the answer', async () => {
    fetchMock.mockResolvedValue(json(200, verdictResponse({ lo: 2, hi: 3 })))
    const { api } = mountComposable({ lo: 1, hi: 2 })

    api.setObservedLocal('2026-09-25T08:00')
    api.setObservedLocal('2026-09-25T09:00')
    expect(api.pending.value).toBe(true)
    expect(api.canSubmit.value).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/functions\/v1\/trail-condition$/)
    expect(JSON.parse(init.body)).toEqual({
      spotType: 'trail',
      spotId: 't1',
      at: new Date('2026-09-25T09:00').toISOString(),
    })
    expect(api.modelRange.value).toEqual({ lo: 2, hi: 3 })
    expect(api.range.value).toEqual({ lo: 2, hi: 3 })
    expect(api.pending.value).toBe(false)
    expect(api.canSubmit.value).toBe(true)
  })

  it('a rider tap during the refetch does not survive: the answer replaces the pre-fill', async () => {
    fetchMock.mockResolvedValue(json(200, verdictResponse({ lo: 0, hi: 1 })))
    const { api } = mountComposable({ lo: 1, hi: 2 })
    api.setObservedLocal('2026-09-25T09:00')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flushPromises()
    expect(api.range.value).toEqual({ lo: 0, hi: 1 })
  })

  it('ignores a stale answer when the picker moved on', async () => {
    let releaseFirst!: () => void
    fetchMock
      .mockImplementationOnce(() => new Promise((res) => { releaseFirst = () => res(json(200, verdictResponse({ lo: 3, hi: 3 }))) }))
      .mockResolvedValueOnce(json(200, verdictResponse({ lo: 0, hi: 0 })))
    const { api } = mountComposable()

    api.setObservedLocal('2026-09-25T08:00')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    api.setObservedLocal('2026-09-25T09:00')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flushPromises()
    releaseFirst()
    await flushPromises()

    expect(api.range.value).toEqual({ lo: 0, hi: 0 })
  })

  it('a time without soil verdict (range null) shows no-verdict and blocks submit', async () => {
    fetchMock.mockResolvedValue(json(200, verdictResponse(null)))
    const { api } = mountComposable()
    api.setObservedLocal('2026-09-25T09:00')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flushPromises()
    expect(api.noVerdict.value).toBe(true)
    expect(api.canSubmit.value).toBe(false)
  })

  it('a failed refetch blocks submit with a load error instead of sending a stale range', async () => {
    fetchMock.mockResolvedValue(json(500, { error: 'x' }))
    const { api } = mountComposable()
    api.setObservedLocal('2026-09-25T09:00')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flushPromises()
    expect(api.loadFailed.value).toBe(true)
    expect(api.canSubmit.value).toBe(false)
  })
})

describe('useSoilFeedback — submit', () => {
  it('sends exactly the report to soil-report with the shared store token, then is done', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }))
    const { api } = mountComposable({ lo: 1, hi: 2 })
    api.tap(3)
    api.snowFrost.value = true
    api.raining.value = true

    const p = api.submit()
    expect(api.state.value).toBe('sending')
    await p

    expect(api.state.value).toBe('done')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(/\/functions\/v1\/soil-report$/)
    expect(init.headers.Authorization).toBe('Bearer jwt-abc')
    expect(JSON.parse(init.body)).toEqual({
      spotType: 'trail',
      spotId: 't1',
      observedAt: new Date('2026-09-26T10:30').toISOString(),
      rangeLo: 3,
      rangeHi: 3,
      flags: ['snow', 'frozen', 'raining'],
    })
  })

  it('422 no_soil_verdict blocks further submits; other failures keep the selection and allow retry', async () => {
    const { api } = mountComposable({ lo: 1, hi: 2 })
    api.tap(0)

    fetchMock.mockResolvedValueOnce(json(500, { error: 'boom' }))
    await api.submit()
    expect(api.state.value).toBe('error')
    expect(api.noVerdict.value).toBe(false)
    expect(api.range.value).toEqual({ lo: 0, hi: 0 })
    expect(api.canSubmit.value).toBe(true)

    fetchMock.mockResolvedValueOnce(json(422, { error: 'no_soil_verdict' }))
    await api.submit()
    expect(api.state.value).toBe('error')
    expect(api.noVerdict.value).toBe(true)
    expect(api.canSubmit.value).toBe(false)
  })

  it('does not send twice while sending', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }))
    const { api } = mountComposable()
    const first = api.submit()
    await api.submit()
    await first
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
