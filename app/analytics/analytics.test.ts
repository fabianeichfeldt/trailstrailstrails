// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { activeExperiment, assignVariant, variantTag } from './experiments'
import { createEngagement } from './engagement'
import { claimSpotView, markRouteChange, spotViewEvent } from './spotView'
import { startHeartbeat } from './heartbeat'
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
    expect(activeExperiment(config as never)?.id).toBe('aa-baseline-2')
  })
})

describe('variantTag', () => {
  it('is id:variant, or null', () => {
    expect(variantTag({ experimentId: 'aa-baseline', variant: 'b' })).toBe('aa-baseline:b')
    expect(variantTag(null)).toBeNull()
  })
})

describe('createEngagement (v2)', () => {
  const setup = () => {
    let t = 0
    const fn = vi.fn()
    const rec = createEngagement(fn, 2, () => t)
    return { fn, rec, at: (ms: number) => { t = ms } }
  }
  it('fires once after the 2nd counted action and ignores engaged/active/spot_land', () => {
    const { fn, rec } = setup()
    rec('engaged'); rec('active'); rec('spot_land'); rec('active')
    expect(fn).not.toHaveBeenCalled()
    rec('like')
    expect(fn).not.toHaveBeenCalled()
    rec('share')
    expect(fn).toHaveBeenCalledTimes(1)
    rec('like'); rec('share')
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('counts a pin tap and the spot_open within 5 s as one action', () => {
    const { fn, rec, at } = setup()
    rec('map_pin_open'); at(4000); rec('spot_open')
    expect(fn).not.toHaveBeenCalled()
  })
  it('counts a search and the spot_open within 5 s as one action', () => {
    const { fn, rec, at } = setup()
    rec('search'); at(5000); rec('spot_open')
    expect(fn).not.toHaveBeenCalled()
  })
  it('counts pin + spot_open after 6 s as two actions', () => {
    const { fn, rec, at } = setup()
    rec('map_pin_open'); at(6000); rec('spot_open')
    expect(fn).toHaveBeenCalledTimes(1)
  })
  it('counts a spot_open without a lead action', () => {
    const { fn, rec } = setup()
    rec('spot_open'); rec('spot_open')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

// Live data: a second spot_open 28 s later on the same page, no pageview between: a remounted page instance.
describe('claimSpotView', () => {
  it('reports a spot once per route change, even if the page instance remounts', () => {
    markRouteChange()
    expect(claimSpotView('spot-1')).toBe(true)
    expect(claimSpotView('spot-1')).toBe(false)
  })

  it('reports again after navigating (incl. back to the same spot) and for another spot', () => {
    markRouteChange()
    expect(claimSpotView('spot-1')).toBe(true)
    expect(claimSpotView('spot-2')).toBe(true)
    markRouteChange()
    expect(claimSpotView('spot-1')).toBe(true)
  })
})

describe('spotViewEvent', () => {
  it('is spot_land on the first route and spot_open for in-app navigation', () => {
    expect(spotViewEvent(true)).toBe('spot_land')
    expect(spotViewEvent(false)).toBe('spot_open')
  })
})

describe('startHeartbeat', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  const hidden = (v: DocumentVisibilityState) => vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(v)

  it('pings only with a visible tab and an interaction in the last 30 s', () => {
    hidden('visible')
    const send = vi.fn()
    const stop = startHeartbeat(send)
    vi.advanceTimersByTime(30_000)
    expect(send).not.toHaveBeenCalled() // no interaction yet
    document.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(30_000)
    expect(send).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(30_000) // idle 30 s: the window has lapsed
    expect(send).toHaveBeenCalledTimes(1)
    stop()
  })
  it('does not ping while hidden', () => {
    hidden('hidden')
    const send = vi.fn()
    const stop = startHeartbeat(send)
    document.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(30_000)
    expect(send).not.toHaveBeenCalled()
    stop()
  })
  it('stops after the cap and on stop()', () => {
    hidden('visible')
    const send = vi.fn()
    const stop = startHeartbeat(send, document, Date.now, 3)
    for (let i = 0; i < 6; i++) { document.dispatchEvent(new Event('scroll')); vi.advanceTimersByTime(30_000) }
    expect(send).toHaveBeenCalledTimes(3)
    stop()
  })
  it('stop() removes the timer', () => {
    hidden('visible')
    const send = vi.fn()
    const stop = startHeartbeat(send)
    document.dispatchEvent(new Event('wheel'))
    stop()
    vi.advanceTimersByTime(90_000)
    expect(send).not.toHaveBeenCalled()
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
    track('active')
    track('locate_me')
    track('share')
    expect(stub.mock.calls.map(c => c[0])).toEqual(['filter_toggle', 'active', 'locate_me', 'engaged', 'share'])
  })
})
