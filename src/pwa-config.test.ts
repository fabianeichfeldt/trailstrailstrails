// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Resolve project root relative to this file (src/pwa-config.test.ts → ../)
const ROOT = new URL('../', import.meta.url).pathname
const nuxtConfig = readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8')

// Regression test for a real production bug: @vite-pwa/nuxt defaults
// workbox.navigateFallback to '/', which registers a service-worker
// NavigationRoute *before* our runtimeCaching rules. That route wins for
// any navigation whose URL isn't an exact string match in the precache
// manifest — silently serving the cached homepage instead of the real
// page. It broke every individual trail page (excluded from precache by
// globIgnores), every embed page (never prerendered), and even precached
// static files whose manifest key doesn't match the requested URL
// (e.g. "test-embed" vs the actual "/test-embed.html").
//
// This site is fully SSG, so there is no app-shell to fall back to —
// navigateFallback must stay disabled (workbox-build only accepts
// null|string, so `null` is the "disabled" value, not `false`).
describe('PWA service worker does not shadow navigation with a homepage fallback', () => {
  test('workbox.navigateFallback is explicitly disabled', () => {
    const workboxBlock = nuxtConfig.match(/workbox:\s*{[\s\S]*?\n {4}}/)
    expect(workboxBlock).not.toBeNull()
    expect(workboxBlock![0]).toMatch(/navigateFallback:\s*null/)
  })
})
