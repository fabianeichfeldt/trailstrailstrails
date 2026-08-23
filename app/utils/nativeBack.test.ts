import { describe, it, expect, vi, afterEach } from 'vitest'
import { registerBackHandler, runBackHandlers } from './nativeBack'

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
})
