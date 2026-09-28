import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createVisitTracker } from './visit'

describe('createVisitTracker', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('collapses a replace+push burst (navigateToSpot marker click) into one call for the final path', () => {
    const send = vi.fn()
    const scheduleVisit = createVisitTracker(send)

    // Mirrors useTrailMap.ts navigateToSpot(): router.replace('/map?trail=id')
    // immediately followed by router.push('/trails/slug') for a single click.
    scheduleVisit('/map', 'https://trailradar.org/')
    scheduleVisit('/trails/foo-trail', 'https://trailradar.org/map')

    vi.runAllTimers()

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('/trails/foo-trail', 'https://trailradar.org/')
  })

  it('collapses a legacy id -> slug redirect chained after the marker-click hop', () => {
    const send = vi.fn()
    const scheduleVisit = createVisitTracker(send)

    scheduleVisit('/map', 'https://trailradar.org/')
    scheduleVisit('/trails/abc123', 'https://trailradar.org/map')
    scheduleVisit('/trails/foo-trail', 'https://trailradar.org/trails/abc123')

    vi.runAllTimers()

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('/trails/foo-trail', 'https://trailradar.org/')
  })

  it('still tracks a real journey of distinct, well-spaced page views separately', () => {
    const send = vi.fn()
    const scheduleVisit = createVisitTracker(send)

    scheduleVisit('/', 'https://google.com')
    vi.runAllTimers()

    scheduleVisit('/trails/trail-1', 'https://trailradar.org/')
    vi.runAllTimers()

    scheduleVisit('/trails/trail-2', 'https://trailradar.org/trails/trail-1')
    vi.runAllTimers()

    expect(send).toHaveBeenCalledTimes(3)
    expect(send).toHaveBeenNthCalledWith(1, '/', 'https://google.com')
    expect(send).toHaveBeenNthCalledWith(2, '/trails/trail-1', 'https://trailradar.org/')
    expect(send).toHaveBeenNthCalledWith(3, '/trails/trail-2', 'https://trailradar.org/trails/trail-1')
  })
})
