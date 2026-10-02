import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { renderToString } from 'vue/server-renderer'
import type { TrailConditionResponse } from '~/types/Weather'

const fetchTrailCondition = vi.fn()
vi.mock('~/communication/weather', () => ({ fetchTrailCondition: (...args: unknown[]) => fetchTrailCondition(...args) }))

const getToken = vi.fn()
vi.stubGlobal('useAuthStore', () => ({ getToken }))

import { useTrailCondition } from './useTrailCondition'

const CONDITION = { verdict: { level: 'prime' } } as TrailConditionResponse

function probe(source: () => { spotType: string; spotId: string } | null) {
  return defineComponent({
    setup() {
      const { condition, loading, forbidden } = useTrailCondition(source)
      return () => h('span', {
        'data-loading': String(loading.value),
        'data-forbidden': String(forbidden.value),
        'data-level': condition.value?.verdict.level ?? '',
      })
    },
  })
}

beforeEach(() => {
  fetchTrailCondition.mockReset()
  getToken.mockReset().mockResolvedValue('jwt-abc')
})

describe('useTrailCondition', () => {
  it('makes no request while the source is null', async () => {
    const wrapper = mount(probe(() => null))
    await flushPromises()

    expect(fetchTrailCondition).not.toHaveBeenCalled()
    expect(wrapper.attributes('data-level')).toBe('')
  })

  it('requests once for a spot, with the user token, and exposes the condition', async () => {
    fetchTrailCondition.mockResolvedValue(CONDITION)
    const wrapper = mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()

    expect(fetchTrailCondition).toHaveBeenCalledTimes(1)
    expect(fetchTrailCondition.mock.calls[0]!.slice(0, 3)).toEqual(['trail', 't1', 'jwt-abc'])
    expect(wrapper.attributes('data-level')).toBe('prime')
    expect(wrapper.attributes('data-loading')).toBe('false')
  })

  it('starts requesting once the source turns non-null (entitlement arrives late)', async () => {
    fetchTrailCondition.mockResolvedValue(CONDITION)
    const source = ref<{ spotType: string; spotId: string } | null>(null)
    const wrapper = mount(probe(() => source.value))
    await flushPromises()
    expect(fetchTrailCondition).not.toHaveBeenCalled()

    source.value = { spotType: 'trail', spotId: 't1' }
    await nextTick()
    await flushPromises()

    expect(fetchTrailCondition).toHaveBeenCalledTimes(1)
    expect(wrapper.attributes('data-level')).toBe('prime')
  })

  it('flags a 403 as forbidden, so the page can show the locked teaser', async () => {
    fetchTrailCondition.mockImplementation(async (_t, _i, _jwt, onForbidden: () => void) => {
      onForbidden()
      return null
    })
    const wrapper = mount(probe(() => ({ spotType: 'trail', spotId: 't1' })))
    await flushPromises()

    expect(wrapper.attributes('data-forbidden')).toBe('true')
    expect(wrapper.attributes('data-level')).toBe('')
    expect(wrapper.attributes('data-loading')).toBe('false')
  })

  it('never requests during SSR — the onMounted guard keeps the build day out of the static HTML', async () => {
    fetchTrailCondition.mockResolvedValue(CONDITION)
    const html = await renderToString(h(probe(() => ({ spotType: 'trail', spotId: 't1' }))))

    expect(fetchTrailCondition).not.toHaveBeenCalled()
    expect(html).toContain('data-loading="true"')
  })
})
