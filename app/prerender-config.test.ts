// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Resolve project root relative to this file (app/prerender-config.test.ts → ../)
const ROOT = new URL('../', import.meta.url).pathname
const nuxtConfig = readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8')

// Regression test for a real production bug: /embed/[token].vue is a real
// Nuxt page (distinct from the /_embed/[token] API, which the Cloudflare
// Worker serves at runtime). Nitro's prerender crawler only follows
// <a href> links (see nitropack's extractLinks), never <iframe src> — and
// the embed page is only ever linked to via an iframe. So without an
// explicit prerender entry, every embed token 404s in production, for
// every customer using the embed feature, not just the site's own demo
// token used on trail detail pages.
// The crawler may not find these (profile is client-gated; /supporter/danke is
// only reached via Creem's external redirect, which would 404 on GitHub Pages),
// and the §312k cancellation page must exist as static HTML — list explicitly.
describe('Billing pages are in the explicit prerender route list', () => {
  test.each(['/supporter/danke', '/kuendigen'])('%s is prerendered', (route) => {
    expect(nuxtConfig).toContain(`'${route}',`)
  })
})

// Linked from the footer, but must never depend on the crawler: §5 DDG requires it to be reachable.
test.each(['/impressum', '/kontakt', '/plans'])('%s is in the explicit prerender route list', (route) => {
  expect(nuxtConfig).toContain(`'${route}',`)
})

describe('Embed token pages are included in the prerender route list', () => {
  test('nitro:config hook fetches embed_tokens and prerenders /embed/{token}', () => {
    expect(nuxtConfig).toMatch(/embed_tokens\?select=token&is_active=eq\.true/)
    expect(nuxtConfig).toMatch(/prerender\.routes as string\[\]\)\.push\(`\/embed\/\$\{t\.token\}`\)/)
  })
})

// Hidden trails (visible = false) must get no prerendered page, sitemap entry, nearby entry or redirect stub.
test('nitro:config hook fetches only visible trails', () => {
  expect(nuxtConfig).toMatch(/rest\/v1\/trails\?select=\$\{spotFields\}&visible=eq\.true/)
})
