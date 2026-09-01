// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Resolve project root relative to this file (app/pwa-config.test.ts → ../)
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

// Regression test for a second real production bug: HTML was precached
// (globPatterns included `html`), so workbox served it cache-first and only
// swapped it when a *new service worker* installed and activated. When the
// /sw.js update check was delayed — a CDN-cached service-worker script, an
// offline tab — returning visitors stayed pinned to the HTML their worker
// cached on a previous visit, for days. The fix: precache only
// content-hashed assets, and serve every navigation network-first so a
// content deploy lands on the next online visit no matter what the worker
// is doing.
describe('PWA content stays fresh independently of the service-worker update cycle', () => {
  const workboxBlock = nuxtConfig.match(/workbox:\s*{[\s\S]*?\n {4}}/)![0]

  test('HTML is not precached', () => {
    const globPatterns = workboxBlock.match(/globPatterns:\s*\[[^\]]*\]/)![0]
    expect(globPatterns).not.toMatch(/\bhtml\b/)
  })

  test('navigations are handled network-first', () => {
    expect(workboxBlock).toMatch(/request\.mode === 'navigate'/)
    const navRuleTail = workboxBlock.slice(workboxBlock.indexOf("request.mode === 'navigate'"))
    expect(navRuleTail).toMatch(/handler:\s*'NetworkFirst'/)
  })

  test('a periodic update check is configured so long-lived tabs pick up new workers', () => {
    expect(nuxtConfig).toMatch(/periodicSyncForUpdates:\s*\d/)
  })
})
