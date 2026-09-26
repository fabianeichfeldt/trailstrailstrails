import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { ConditionRange } from '~/types/Weather'

const getToken = vi.fn()
vi.stubGlobal('useAuthStore', () => ({ getToken }))

import SoilFeedbackSheet from './SoilFeedbackSheet.vue'
import { DEBOUNCE_MS } from '~/composables/useSoilFeedback'

// Only `fetch` (the HTTP boundary) is faked; everything above it is real.
const fetchMock = vi.fn()
const realFetch = globalThis.fetch

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}
function verdict(range: ConditionRange | null) {
  return json(200, {
    verdict: { level: 'damp', headline: 'h', detail: 'd', rain10dMm: 1, range },
    rainRule: { raining: false, hoursSinceRain: 1 },
    current: { temperature: 1, apparentTemperature: 1, icon: 'x', windKmh: 1 },
    strip: [],
    fetchedAt: '2026-09-26T10:00:00.000Z',
  })
}

function mountSheet(modelRange: ConditionRange = { lo: 1, hi: 2 }) {
  return mount(SoilFeedbackSheet, {
    props: { spotType: 'trail', spotId: 't1', modelRange },
    global: { stubs: { teleport: true } },
  })
}

const action = (w: ReturnType<typeof mountSheet>) => w.find('[data-testid="soil-submit"]')
const segs = (w: ReturnType<typeof mountSheet>) => w.findAll('.cs-seg')
const bodies = () => fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), body: JSON.parse(init.body) }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-26T10:30:45'))
  fetchMock.mockReset()
  getToken.mockReset().mockResolvedValue('jwt-abc')
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  globalThis.fetch = realFetch
  vi.useRealTimers()
})

describe('SoilFeedbackSheet — structure', () => {
  it('is a labelled modal dialog with the model range pre-selected on an interactive scale', () => {
    const wrapper = mountSheet({ lo: 1, hi: 2 })

    expect(wrapper.find('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(wrapper.find('[role="dialog"]').attributes('aria-labelledby')).toBeTruthy()
    expect(segs(wrapper).map((s) => s.classes().includes('on'))).toEqual([false, true, true, false])
    expect(wrapper.findAll('.cs-seg')[0]!.element.tagName).toBe('BUTTON')
  })

  it('offers a datetime-local picker: default now, max now, min now minus 3 days', () => {
    const input = mountSheet().find('input[type="datetime-local"]')

    expect(input.element.value).toBe('2026-09-26T10:30')
    expect(input.attributes('max')).toBe('2026-09-26T10:30')
    expect(input.attributes('min')).toBe('2026-09-23T10:30')
  })

  it('offers the optional Schnee/Frost and Regen toggles, off by default', () => {
    const wrapper = mountSheet()
    const boxes = wrapper.findAll('input[type="checkbox"]')
    expect(boxes).toHaveLength(2)
    expect(wrapper.text()).toContain('Schnee/Frost')
    expect(wrapper.text()).toContain('Regen')
    expect(boxes.every((b) => !b.element.checked)).toBe(true)
  })
})

describe('SoilFeedbackSheet — dismissal', () => {
  it('closes via the close button, the backdrop and Escape, but not by clicking inside', async () => {
    const wrapper = mountSheet()

    await wrapper.find('.sheet').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.find('[data-testid="soil-close"]').trigger('click')
    await wrapper.find('.backdrop').trigger('click')
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(3)
  })
})

describe('SoilFeedbackSheet — action button', () => {
  it('says "Stimmt so" while range and toggles are unchanged, "Senden" after any change', async () => {
    const wrapper = mountSheet()
    expect(action(wrapper).text()).toBe('Stimmt so')

    await segs(wrapper)[3]!.trigger('click')
    expect(action(wrapper).text()).toBe('Senden')

    // Back to the model range: reset by tapping the lone segment again.
    await segs(wrapper)[3]!.trigger('click')
    expect(action(wrapper).text()).toBe('Stimmt so')

    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true)
    expect(action(wrapper).text()).toBe('Senden')
  })
})

describe('SoilFeedbackSheet — submitting', () => {
  it('posts exactly { spotType, spotId, observedAt, rangeLo, rangeHi, flags } to soil-report, then thanks and closes', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }))
    const wrapper = mountSheet({ lo: 1, hi: 2 })

    await segs(wrapper)[3]!.trigger('click') // alone: 3..3
    await segs(wrapper)[2]!.trigger('click') // extends: 2..3
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(true)
    await action(wrapper).trigger('click')
    await flushPromises()

    const calls = bodies()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toMatch(/\/functions\/v1\/soil-report$/)
    expect(calls[0]!.body).toEqual({
      spotType: 'trail',
      spotId: 't1',
      observedAt: new Date('2026-09-26T10:30').toISOString(),
      rangeLo: 2,
      rangeHi: 3,
      flags: ['snow', 'frozen'],
    })
    expect(wrapper.text()).toContain('Danke')

    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('a plain "Stimmt so" confirms the model range unchanged', async () => {
    fetchMock.mockResolvedValue(json(200, { ok: true }))
    const wrapper = mountSheet({ lo: 1, hi: 2 })
    await action(wrapper).trigger('click')
    await flushPromises()
    expect(bodies()[0]!.body).toMatchObject({ rangeLo: 1, rangeHi: 2, flags: [] })
  })

  it('on failure stays open, keeps the selection and shows a retry message; retry works', async () => {
    fetchMock.mockResolvedValueOnce(json(500, { error: 'boom' }))
    const wrapper = mountSheet({ lo: 1, hi: 2 })
    await segs(wrapper)[0]!.trigger('click')
    await action(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.find('[data-testid="soil-error"]').text()).toContain('erneut')
    expect(segs(wrapper).map((s) => s.classes().includes('on'))).toEqual([true, false, false, false])
    expect(action(wrapper).attributes('disabled')).toBeUndefined()

    fetchMock.mockResolvedValueOnce(json(200, { ok: true }))
    await action(wrapper).trigger('click')
    await flushPromises()
    expect(bodies()[1]!.body).toMatchObject({ rangeLo: 0, rangeHi: 0 })
    expect(wrapper.text()).toContain('Danke')
  })

  it('422 no_soil_verdict shows the no-estimate message and disables submit', async () => {
    fetchMock.mockResolvedValue(json(422, { error: 'no_soil_verdict' }))
    const wrapper = mountSheet()
    await action(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Für diesen Zeitpunkt haben wir keine Schätzung')
    expect(action(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })
})

describe('SoilFeedbackSheet — picking another ride time', () => {
  async function pick(wrapper: ReturnType<typeof mountSheet>, value: string) {
    const input = wrapper.find('input[type="datetime-local"]')
    await input.setValue(value)
  }

  it('asks trail-condition for that instant, disables submit meanwhile, and pre-fills the answer', async () => {
    let answer!: () => void
    fetchMock.mockImplementation(() => new Promise((res) => { answer = () => res(verdict({ lo: 2, hi: 3 })) }))
    const wrapper = mountSheet({ lo: 1, hi: 2 })

    await pick(wrapper, '2026-09-25T08:00')
    expect(action(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.find('.cs').attributes('aria-busy')).toBe('true')

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    const [call] = bodies()
    expect(call!.url).toMatch(/\/functions\/v1\/trail-condition$/)
    expect(call!.body).toEqual({ spotType: 'trail', spotId: 't1', at: new Date('2026-09-25T08:00').toISOString() })
    // Still pending until the answer lands.
    expect(action(wrapper).attributes('disabled')).toBeDefined()

    answer()
    await flushPromises()

    expect(segs(wrapper).map((s) => s.classes().includes('on'))).toEqual([false, false, true, true])
    expect(action(wrapper).attributes('disabled')).toBeUndefined()
    expect(action(wrapper).text()).toBe('Stimmt so')
  })

  it('a time without a soil verdict shows the no-estimate message and blocks submit', async () => {
    fetchMock.mockResolvedValue(verdict(null))
    const wrapper = mountSheet()
    await pick(wrapper, '2026-09-25T08:00')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flushPromises()

    expect(wrapper.text()).toContain('Für diesen Zeitpunkt haben wir keine Schätzung')
    expect(action(wrapper).attributes('disabled')).toBeDefined()
  })

  it('submits the picked time, not now', async () => {
    fetchMock.mockResolvedValueOnce(verdict({ lo: 0, hi: 1 })).mockResolvedValueOnce(json(200, { ok: true }))
    const wrapper = mountSheet()
    await pick(wrapper, '2026-09-25T08:00')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flushPromises()
    await action(wrapper).trigger('click')
    await flushPromises()

    expect(bodies()[1]!.body).toMatchObject({
      observedAt: new Date('2026-09-25T08:00').toISOString(),
      rangeLo: 0,
      rangeHi: 1,
    })
  })
})
