import { describe, it, expect, vi, afterEach } from 'vitest'
import { registerBackHandler, runBackHandlers, createBackButtonFallback } from './nativeBack'

// The handler registry is module-level state shared across every test in
// this file, so each test unregisters what it registered on the way out.
const unregisterFns: Array<() => void> = []

function register(handler: () => boolean) {
  const unregister = registerBackHandler(handler)
  unregisterFns.push(unregister)
  return unregister
}

afterEach(() => {
  while (unregisterFns.length) unregisterFns.pop()!()
})

describe('nativeBack', () => {
  it('returns false when no handlers are registered', () => {
    expect(runBackHandlers()).toBe(false)
  })

  it('runs a registered handler and returns its result', () => {
    register(() => true)

    expect(runBackHandlers()).toBe(true)
  })

  it('runs the most-recently-registered handler first (LIFO)', () => {
    const calls: string[] = []
    register(() => { calls.push('first'); return false })
    register(() => { calls.push('second'); return true })

    runBackHandlers()

    expect(calls).toEqual(['second'])
  })

  it('short-circuits: an earlier handler is not called once one returns true', () => {
    const earlier = vi.fn(() => true)
    register(earlier)
    register(() => true)

    runBackHandlers()

    expect(earlier).not.toHaveBeenCalled()
  })

  it('falls through to the next-earlier handler when the top one returns false', () => {
    const earlier = vi.fn(() => true)
    register(earlier)
    register(() => false)

    const result = runBackHandlers()

    expect(earlier).toHaveBeenCalledOnce()
    expect(result).toBe(true)
  })

  it('unregistering a handler stops it from being invoked', () => {
    const handler = vi.fn(() => true)
    const unregister = register(handler)
    unregister()

    const result = runBackHandlers()

    expect(handler).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('unregistering is a no-op if called twice', () => {
    const handler = vi.fn(() => true)
    const unregister = register(handler)
    unregister()

    expect(() => unregister()).not.toThrow()
    expect(runBackHandlers()).toBe(false)
  })

  it('a repeated unregister does not remove a different handler', () => {
    const unregister = register(() => false)
    const other = vi.fn(() => true)
    register(other)
    unregister()

    unregister()

    expect(runBackHandlers()).toBe(true)
    expect(other).toHaveBeenCalledOnce()
  })
})

type FallbackDeps = Parameters<typeof createBackButtonFallback>[0]

// Injected clock starts at a non-zero time; `advance` moves it forward.
function makeFallback(overrides: Partial<FallbackDeps> = {}) {
  let time = 10_000
  const deps: FallbackDeps = {
    runHandlers: vi.fn(() => false),
    historyBack: vi.fn(),
    exitApp: vi.fn(),
    showHint: vi.fn(),
    now: () => time,
    ...overrides,
  }
  return {
    back: createBackButtonFallback(deps),
    deps,
    advance: (ms: number) => { time += ms },
  }
}

describe('createBackButtonFallback', () => {
  it('stops after a page handler consumes the press', () => {
    const { back, deps } = makeFallback({ runHandlers: vi.fn(() => true) })

    back(true)

    expect(deps.historyBack).not.toHaveBeenCalled()
    expect(deps.showHint).not.toHaveBeenCalled()
    expect(deps.exitApp).not.toHaveBeenCalled()
  })

  it('goes back in history when the webview can go back', () => {
    const { back, deps } = makeFallback()

    back(true)

    expect(deps.historyBack).toHaveBeenCalledOnce()
    expect(deps.exitApp).not.toHaveBeenCalled()
    expect(deps.showHint).not.toHaveBeenCalled()
  })

  it('shows the hint on the first press at the root, without exiting', () => {
    const { back, deps } = makeFallback()

    back(false)

    expect(deps.showHint).toHaveBeenCalledOnce()
    expect(deps.exitApp).not.toHaveBeenCalled()
  })

  it('treats a first press at time 0 as a first press, not a double press', () => {
    const { back, deps } = makeFallback({ now: () => 0 })

    back(false)

    expect(deps.showHint).toHaveBeenCalledOnce()
    expect(deps.exitApp).not.toHaveBeenCalled()
  })

  it('exits on a second press within 1999 ms', () => {
    const { back, deps, advance } = makeFallback()
    back(false)
    advance(1999)

    back(false)

    expect(deps.exitApp).toHaveBeenCalledOnce()
    expect(deps.showHint).toHaveBeenCalledOnce()
  })

  it('shows the hint again instead of exiting at exactly 2000 ms', () => {
    const { back, deps, advance } = makeFallback()
    back(false)
    advance(2000)

    back(false)

    expect(deps.exitApp).not.toHaveBeenCalled()
    expect(deps.showHint).toHaveBeenCalledTimes(2)
  })

  it('a press after the window restarts the window, so the next quick press exits', () => {
    const { back, deps, advance } = makeFallback()
    back(false)
    advance(5000)
    back(false)
    advance(1000)

    back(false)

    expect(deps.exitApp).toHaveBeenCalledOnce()
    expect(deps.showHint).toHaveBeenCalledTimes(2)
  })

  it('a history-back press does not count as the first exit press', () => {
    const { back, deps, advance } = makeFallback()
    back(true)
    advance(100)

    back(false)

    expect(deps.exitApp).not.toHaveBeenCalled()
    expect(deps.showHint).toHaveBeenCalledOnce()
  })

  it('honours a custom window', () => {
    const { back, deps, advance } = makeFallback({ windowMs: 500 })
    back(false)
    advance(500)

    back(false)

    expect(deps.exitApp).not.toHaveBeenCalled()
    expect(deps.showHint).toHaveBeenCalledTimes(2)
  })
})
