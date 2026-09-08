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

// Regression test for a third real production bug: the spot-detail page
// (app/pages/trails/[slug].vue) embeds the map as <iframe src="/embed/[token]/?…">,
// and that page fetches its data from the /_embed/[token] Cloudflare Worker.
// Neither path is part of this SSG build. The generic "navigate" NetworkFirst
// rule was catching the iframe navigation: navigation requests are issued with
// redirect:"manual", so a trailing-slash 301 on the iframe URL became an
// opaqueredirect the worker cached and replayed, and the embedded map rendered
// blank / a stale shell in the installed PWA (the main /map kept working, so it
// looked PWA-specific). Both paths need their own runtime caches, kept out of
// the generic navigation rule, so the embed also survives offline.
describe('PWA service worker leaves the embedded-map iframe to its own cache', () => {
  const workboxBlock = nuxtConfig.match(/workbox:\s*{[\s\S]*?\n {4}}/)![0]

  test('the generic navigation rule skips /embed/ and /_embed/ paths', () => {
    const navRule = workboxBlock.slice(workboxBlock.indexOf("request.mode === 'navigate'"))
    const urlPattern = navRule.slice(0, navRule.indexOf('handler:'))
    expect(urlPattern).toContain("pathname.startsWith('/embed/')")
    expect(urlPattern).toContain("pathname.startsWith('/_embed/')")
  })

  test('the /embed/ iframe page has its own runtime cache, separate from "pages"', () => {
    expect(workboxBlock).toContain("cacheName: 'embed-page'")
  })

  test('the /_embed/ worker API has its own network-first runtime cache', () => {
    expect(workboxBlock).toContain("cacheName: 'embed-data'")
    const embedDataRule = workboxBlock.slice(workboxBlock.indexOf("cacheName: 'embed-data'") - 400, workboxBlock.indexOf("cacheName: 'embed-data'"))
    expect(embedDataRule).toMatch(/handler:\s*'NetworkFirst'/)
  })
})
