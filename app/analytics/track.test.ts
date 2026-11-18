// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Module state is per page load, so each test gets a fresh module.
async function load() {
  vi.resetModules()
  const umami = { track: vi.fn() }
  vi.stubGlobal('umami', umami)
  ;(window as any).umami = umami
  return { umami, ...(await import('./track')) }
}

beforeEach(() => { delete (window as any).umami })

describe('engaged state', () => {
  it('flips and notifies subscribers after the 2nd counted action, not on funnel events', async () => {
    const { track, hasEngaged, onEngaged } = await load()
    const cb = vi.fn()
    onEngaged(cb)
    track('radar_open'); track('locked_view', { logged_in: false }); track('signup_start'); track('signup_done')
    expect(hasEngaged()).toBe(false)
    track('like')
    expect(cb).not.toHaveBeenCalled()
    track('share')
    expect(hasEngaged()).toBe(true)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('stops notifying after unsubscribe', async () => {
    const { track, onEngaged } = await load()
    const cb = vi.fn()
    onEngaged(cb)()
    track('like'); track('share')
    expect(cb).not.toHaveBeenCalled()
  })
})
