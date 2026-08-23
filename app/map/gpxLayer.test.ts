import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHideController } from './gpxLayer'

describe('createHideController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('hides the element after 800 ms when schedule() is called', () => {
    const el = { style: { display: 'block' } } as HTMLElement
    const hide = createHideController(el)
    hide.schedule()
    expect(el.style.display).toBe('block')
    vi.advanceTimersByTime(800)
    expect(el.style.display).toBe('none')
  })

  it('cancel() prevents the element from being hidden', () => {
    const el = { style: { display: 'block' } } as HTMLElement
    const hide = createHideController(el)
    hide.schedule()
    hide.cancel()
    vi.advanceTimersByTime(1000)
    expect(el.style.display).toBe('block')
  })

  it('schedule() resets the timer when called a second time', () => {
    const el = { style: { display: 'block' } } as HTMLElement
    const hide = createHideController(el)
    hide.schedule()
    vi.advanceTimersByTime(400)
    hide.schedule()              // reset: 800 ms from now
    vi.advanceTimersByTime(400)  // only 400 ms into new window
    expect(el.style.display).toBe('block')
    vi.advanceTimersByTime(400)  // now 800 ms complete
    expect(el.style.display).toBe('none')
  })
})
