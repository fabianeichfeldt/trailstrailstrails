// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./[token].vue', import.meta.url), 'utf8')
const scriptStart = src.indexOf('<script setup')
const asyncMountStart = src.indexOf('onMounted(async')

// Regression test for a real bug: the `message` listener (parent page flying
// the embedded map, see app/pages/trails/[slug].vue) and its `onUnmounted`
// cleanup were both set up *inside* the async onMounted callback — after the
// `await` for the _embed fetch and the `await import('leaflet')`. By then the
// component instance is no longer active, so Vue logs
//   "onUnmounted is called when there is no active component instance"
// and the cleanup is silently dropped, leaking a window listener on unmount.
// The teardown must be owned from synchronous setup.
describe('embed [token].vue lifecycle', () => {
  test('the async onMounted is present after the script setup opens', () => {
    expect(scriptStart).toBeGreaterThan(-1)
    expect(asyncMountStart).toBeGreaterThan(scriptStart)
  })

  test('registers onUnmounted synchronously in setup, not inside the async onMounted', () => {
    const unmountCalls = [...src.matchAll(/onUnmounted\(/g)].map(m => m.index!)
    expect(unmountCalls).toHaveLength(1)
    expect(unmountCalls[0]).toBeGreaterThan(scriptStart)
    expect(unmountCalls[0]).toBeLessThan(asyncMountStart)
  })

  test('the window message listener is bound to an abort signal so it is cleaned up on unmount', () => {
    expect(src).toMatch(/new AbortController\(\)/)
    expect(src).toMatch(/addEventListener\(\s*'message',\s*onFlyToMessage,\s*\{\s*signal:\s*teardown\.signal\s*\}\s*\)/)
    expect(src).not.toMatch(/removeEventListener\(\s*'message'/)
  })
})
