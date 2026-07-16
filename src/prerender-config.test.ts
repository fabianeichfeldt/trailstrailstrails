// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Resolve project root relative to this file (src/prerender-config.test.ts → ../)
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
describe('Embed token pages are included in the prerender route list', () => {
  test('nitro:config hook fetches embed_tokens and prerenders /embed/{token}', () => {
    expect(nuxtConfig).toMatch(/embed_tokens\?select=token&is_active=eq\.true/)
    expect(nuxtConfig).toMatch(/prerender\.routes as string\[\]\)\.push\(`\/embed\/\$\{t\.token\}`\)/)
  })
})
