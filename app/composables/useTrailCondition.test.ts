import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils'
import { renderToString } from 'vue/server-renderer'
import type { TrailConditionResponse } from '~/types/Weather'
import type { FeatureAccess } from '~/entitlements/features'
import { FUNCTIONS } from '~/communication/http'

// Only the network is mocked (`fetch`); the composable, the gate and the cache run for real.
const getToken = vi.fn()
function makeAuth() {
  const a = reactive({ userId: 'u1', getToken, getUserId: async () => a.userId })
  return a
}
let auth = makeAuth()
vi.stubGlobal('useAuthStore', () => auth)
const access = ref<FeatureAccess>('allowed')
vi.stubGlobal('useSubscriptionStore', () => ({ accessFor: () => access.value }))

import { useTrailCondition } from './useTrailCondition'

function condition(level: TrailConditionResponse['verdict']['level'] = 'prime'): TrailConditionResponse {
  return {
    verdict: { level, headline: 'h', detail: 'd', rain10dMm: 1 },
    rainRule: { raining: false, hoursSinceRain: 31 },
    current: { temperature: 12, apparentTemperature: 10, icon: '⛅', windKmh: 13 },
    strip: [],
    fetchedAt: '2026-09-24T10:00:00.000Z',
  } as unknown as TrailConditionResponse
}

function respond(status: number, body: unknown = condition()) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

let fetchMock = vi.fn()

type Source = { spotType: string; spotId: string } | null

function probe(source: () => Source) {
  return defineComponent({
    setup() {
      const r = useTrailCondition(source)
      return () => h('span', {
        'data-loading': String(r.loading.value),
        'data-state': r.state.value,
        'data-level': r.condition.value?.verdict.level ?? '',
      })
    },
  })
}

beforeEach(() => {
  localStorage.clear()
  getToken.mockReset().mockResolvedValue('jwt-abc')
  auth = makeAuth()
  access.value = 'allowed'
  fetchMock = vi.fn().mockResolvedValue(respond(200))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.useRealTimers())
// Earlier tests' components share `access`; left mounted they would react to this test's changes.
enableAutoUnmount(afterEach)

describe('useTrailCondition', () => {
  it('makes no request while the source is null', async () => {
    const wrapper = mount(probe(() => null))
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.attributes('data-level')).toBe('')
  })

  it('requests once for a spot, with the user token, and exposes the condition', async () => {
    const wrapper = mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(`${FUNCTIONS}/trail-condition`)
    expect(init.headers.Authorization).toBe('Bearer jwt-abc')
    expect(JSON.parse(init.body)).toEqual({ spotType: 'trail', spotId: 't1' })
    expect(wrapper.attributes('data-level')).toBe('prime')
    expect(wrapper.attributes('data-loading')).toBe('false')
  })

  it('starts requesting once the source turns non-null', async () => {
    const source = ref<Source>(null)
    const wrapper = mount(probe(() => source.value))
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()

    source.value = { spotType: 'trail', spotId: 't1' }
    await nextTick()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.attributes('data-level')).toBe('prime')
  })

  it('serves a card younger than an hour from the cache, and refetches after that', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-24T10:00:00Z'))
    mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()
    vi.setSystemTime(new Date('2026-09-24T10:59:00Z'))
    mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-09-24T11:01:00Z'))
    mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('never requests during SSR — the onMounted guard keeps the build day out of the static HTML', async () => {
    const html = await renderToString(h(probe(() => ({ spotType: 'trail', spotId: 't1' }))))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(html).toContain('data-loading="true"')
  })
})

describe('useTrailCondition — paid data and its owner', () => {
  // Storage is swept app-wide, gate or no gate: plugins/paidCacheSweep.client.test.ts.
  it('signing out drops the card from the page', async () => {
    const wrapper = mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()
    expect(wrapper.attributes('data-level')).toBe('prime')

    auth.userId = ''
    access.value = 'locked'
    await flushPromises()

    expect(wrapper.attributes('data-level')).toBe('')
  })

  it('never serves one user\'s cached card to the next user', async () => {
    mount(probe(() => ({ spotType: 'trail', spotId: 't1' }))).unmount()
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    auth = makeAuth()
    auth.userId = 'u2'
    mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('useTrailCondition — request lifecycle', () => {
  it('an answer for the previous spot never lands on the new one', async () => {
    let answerA!: (v: unknown) => void
    fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
      const { spotId } = JSON.parse(init.body)
      if (spotId === 'a') return new Promise((r) => { answerA = r })
      return respond(200, condition('wet'))
    })
    const source = ref<Source>({ spotType: 'trail', spotId: 'a' })
    const wrapper = mount(probe(() => source.value))
    await flushPromises()

    source.value = { spotType: 'trail', spotId: 'b' }
    await flushPromises()
    expect(wrapper.attributes('data-level')).toBe('wet')

    answerA(respond(200, condition('prime')))
    await flushPromises()

    expect(wrapper.attributes('data-level')).toBe('wet')
  })

  it('does not stay on the skeleton when the token lookup fails', async () => {
    getToken.mockRejectedValue(new Error('session gone'))
    const wrapper = mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()

    expect(wrapper.attributes('data-loading')).toBe('false')
  })
})

describe('useTrailCondition — what the page renders', () => {
  it('renders "checking" during SSR, whatever the entitlement', async () => {
    const html = await renderToString(h(probe(() => ({ spotType: 'trail', spotId: 't1' }))))
    expect(html).toContain('data-state="checking"')
  })

  it('is "locked", and never asks, for a visitor without access', async () => {
    access.value = 'locked'
    const wrapper = mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.attributes('data-state')).toBe('locked')
    expect(wrapper.attributes('data-loading')).toBe('false')
  })

  it('waits on the skeleton while the entitlement is checked, then asks', async () => {
    access.value = 'checking'
    const wrapper = mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(wrapper.attributes('data-loading')).toBe('true')

    access.value = 'allowed'
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.attributes('data-state')).toBe('ready')
  })

  it('a 403 turns it "locked" (the teaser) and drops the cached card', async () => {
    localStorage.setItem('tr_wx_v3_trail_t2', JSON.stringify({ uid: 'u1', at: Date.now(), data: condition() }))
    fetchMock.mockResolvedValue(respond(403, {}))
    const wrapper = mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()

    expect(wrapper.attributes('data-state')).toBe('locked')
    expect(wrapper.attributes('data-level')).toBe('')
    expect(wrapper.attributes('data-loading')).toBe('false')
    expect(localStorage.getItem('tr_wx_v3_trail_t2')).toBeNull()
  })
})
