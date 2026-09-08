// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./[slug].vue', import.meta.url), 'utf8')

// Regression test for a real production bug: the embedded-map <iframe> on a
// spot-detail page pointed at `/embed/${TOKEN}?lat=…` — no trailing slash.
// GitHub Pages serves `/embed/${TOKEN}` as a directory and 301-redirects to
// `/embed/${TOKEN}/`. In a normal browser tab the browser follows that 301
// transparently and the map loads. In the installed PWA the Workbox service
// worker intercepts the iframe navigation (a request issued with
// redirect:"manual"), turns the 301 into an opaqueredirect it caches and
// replays, and the embedded map renders blank / a stale shell.
//
// The fix: request the canonical trailing-slash URL directly, so there is no
// redirect for the service worker to mishandle.
describe('spot-detail embedded-map iframe src is redirect-free', () => {
  const embedUrls = [...src.matchAll(/\/embed\/\$\{EMBED_TOKEN\}(\/?)\?/g)]

  test('both the region and spot iframe srcs are built from a template literal', () => {
    // regionEmbedSrc + embedSrc
    expect(embedUrls).toHaveLength(2)
  })

  test('every /embed/{token} iframe url carries the trailing slash before the query', () => {
    for (const m of embedUrls) {
      expect(m[1], `expected "/embed/\${EMBED_TOKEN}/?" but found "/embed/\${EMBED_TOKEN}?" in:\n${m[0]}`).toBe('/')
    }
  })

  test('no /embed/{token} iframe url omits the trailing slash', () => {
    expect(src).not.toMatch(/\/embed\/\$\{EMBED_TOKEN\}\?/)
  })
})
