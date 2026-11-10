// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activeExperiment, assignVariant, variantTag } from './experiments'
import { createEngagement } from './engagement'
import config from './experiments.json'

const exp = { id: 'x', variants: ['a', 'b', 'c'] }

describe('assignVariant', () => {
  it('maps the random range uniformly onto the variants', () => {
    expect(assignVariant(exp, () => 0)?.variant).toBe('a')
    expect(assignVariant(exp, () => 0.34)?.variant).toBe('b')
    expect(assignVariant(exp, () => 0.99)?.variant).toBe('c')
    expect(assignVariant(exp, () => 1)?.variant).toBe('c')
  })
  it('is null without an active experiment', () => {
    expect(assignVariant(null)).toBeNull()
    expect(activeExperiment({ active: null, experiments: [exp] })).toBeNull()
    expect(activeExperiment({ active: 'missing', experiments: [exp] })).toBeNull()
  })
  it('reads the shipped config', () => {
    expect(activeExperiment(config as never)?.id).toBe('aa-baseline')
  })
})

describe('variantTag', () => {
  it('is id:variant, or null', () => {
    expect(variantTag({ experimentId: 'aa-baseline', variant: 'b' })).toBe('aa-baseline:b')
    expect(variantTag(null)).toBeNull()
  })
})

describe('createEngagement', () => {
  it('fires once after the 2nd event and ignores engaged itself', () => {
    const fn = vi.fn()
    const rec = createEngagement(fn)
    rec('engaged'); rec('engaged')
    expect(fn).not.toHaveBeenCalled()
    rec('spot_open')
    expect(fn).not.toHaveBeenCalled()
    rec('search')
    expect(fn).toHaveBeenCalledTimes(1)
    rec('like'); rec('share')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('track', () => {
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { delete window.umami })

  it('is a silent no-op without window.umami', async () => {
    const { track } = await import('./track')
    expect(() => track('spot_open')).not.toThrow()
  })

  it('forwards to umami and adds engaged after the 2nd event', async () => {
    const stub = vi.fn()
    window.umami = { track: stub }
    const { track } = await import('./track')
    track('filter_toggle', { filter: 'trail', on: false })
    expect(stub).toHaveBeenCalledWith('filter_toggle', { filter: 'trail', on: false })
    track('locate_me')
    track('share')
    expect(stub.mock.calls.map(c => c[0])).toEqual(['filter_toggle', 'locate_me', 'engaged', 'share'])
  })
})
