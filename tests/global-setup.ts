import { chromium, type FullConfig } from '@playwright/test'

// The embed token app/pages/trails/[slug].vue hard-codes for its own map
// iframe. Any value compiles the same route module — this one just matches
// what the real page requests so the warmed chunk is the exact one tests hit.
const EMBED_TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4'

// Routes whose first (cold) Vite dev compile is heavy enough to blow a test's
// timeout on a 2-core CI runner: the map, the [slug].vue trail/region page,
// and the /embed/[token] page it loads in an <iframe>. Hitting them once here
// — before any timed test runs — moves that compile cost out of the tests.
const WARMUP_PATHS = [
  '/map',
  '/trails/allgaeu', // region branch of [slug].vue — renders the /embed iframe
  '/trails/berlin', // second region, exercised by the client-nav test
  '/trails/t1', // trail branch of [slug].vue
  `/embed/${EMBED_TOKEN}?lat=47.71&lng=11.76&zoom=11&parentHost=trailradar.org`,
]

export default async function globalSetup(config: FullConfig) {
  // reuseExistingServer + a warm local dev server = nothing to pre-compile.
  // Skip the cost unless we're on CI (where the server is always cold).
  if (!process.env.CI) return

  const baseURL =
    config.projects[0]?.use?.baseURL ?? 'http://localhost:3000'

  const browser = await chromium.launch()
  const page = await browser.newPage()

  // Warmup only needs the routes to compile and mount — block every external
  // call (Supabase, tiles, CDN) so a bogus placeholder host can't stall us.
  await page.route(
    (url) =>
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.hostname !== 'localhost' &&
      url.hostname !== '127.0.0.1',
    (route) => route.abort(),
  )

  for (const path of WARMUP_PATHS) {
    try {
      await page.goto(`${baseURL}${path}`, {
        waitUntil: 'load',
        timeout: 90_000,
      })
      // Give client-side chunks (the embedded map, lazy iframe) a beat to
      // request-and-compile too, not just the server render.
      await page.waitForTimeout(1500)
    } catch (err) {
      // A warmup miss isn't fatal — the test that hits this route just pays
      // the compile itself, against the now-generous 30s timeout.
      console.warn(`[global-setup] warmup for ${path} did not settle:`, err)
    }
  }

  await browser.close()
}
