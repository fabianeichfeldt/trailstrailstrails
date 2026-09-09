// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./[slug].vue', import.meta.url), 'utf8')

// The spot-detail map is now an inline <SpotDetailMiniMap> component (fed by
// spotPanelStore), not a self-embedding <iframe>. Only the REGION overview
// branch still uses the /embed/[token] iframe.

describe('spot-detail page: inline mini-map, region iframe', () => {
  test('the trail branch renders <SpotDetailMiniMap>, not an <iframe>', () => {
    expect(src).toContain('<SpotDetailMiniMap')
    // The only iframe left is the region overview map.
    const iframes = [...src.matchAll(/<iframe\b/g)]
    expect(iframes).toHaveLength(1)
    expect(src).toMatch(/class="trail-map region-map"/)
  })

  test('no embedSrc / mapIframeEl / flyMapTo plumbing survives on the spot branch', () => {
    expect(src).not.toContain('const embedSrc')
    expect(src).not.toContain('mapIframeEl')
    expect(src).not.toContain('flyMapTo')
  })
})

// The Capacitor native shell runs at origin https://localhost — it has no
// local /embed/{token}/ pages and no /_embed/ worker, so the region iframe
// src must be absolute (https://trailradar.org) there. In dev/E2E and the
// prod web/PWA build the page is served same-origin, so EMBED_BASE stays ''.
// import.meta.dev is a build-time constant, so SSR and client agree — no
// hydration mismatch on the iframe src.
describe('EMBED_BASE is gated on import.meta.dev', () => {
  test('EMBED_BASE is "" in dev and absolute https://trailradar.org otherwise', () => {
    expect(src).toMatch(/const EMBED_BASE = import\.meta\.dev \? '' : 'https:\/\/trailradar\.org'/)
  })
})

// Regression test for a real production bug: the region iframe pointed at
// `/embed/${TOKEN}?lat=…` — no trailing slash. GitHub Pages serves
// `/embed/${TOKEN}` as a directory and 301-redirects to `/embed/${TOKEN}/`.
// In the installed PWA the Workbox service worker turns that 301 into an
// opaqueredirect it caches and replays, and the embedded map renders blank.
// The fix: request the canonical trailing-slash URL directly.
describe('region iframe src is redirect-free', () => {
  test('the region /embed/{token} url carries the trailing slash before the query', () => {
    expect(src).toMatch(/\/embed\/\$\{EMBED_TOKEN\}\/\?/)
    expect(src).not.toMatch(/\/embed\/\$\{EMBED_TOKEN\}\?/)
  })
})
