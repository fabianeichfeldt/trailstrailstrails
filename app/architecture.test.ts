// @vitest-environment node
import { describe, test, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// Resolve project root relative to this file (app/architecture.test.ts → ../)
const ROOT = new URL('../', import.meta.url).pathname

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

function collectTs(dir: string, out: string[] = []): string[] {
  try {
    for (const entry of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${entry}`
      const stat = statSync(join(ROOT, rel))
      if (stat.isDirectory()) collectTs(rel, out)
      else if (/\.(ts|vue)$/.test(entry)) out.push(rel)
    }
  } catch { /* directory does not exist */ }
  return out
}

const HARDCODED_URL_RE = /ixafegmxkadbzhxmepsd\.supabase\.co/

// ─────────────────────────────────────────────────────────────────────────────
// E2E never talks to production
// ─────────────────────────────────────────────────────────────────────────────
// The browser-side safety net (tests/fixtures.ts) can't see SSR fetches made by
// the Nuxt dev server itself; those used to reach the live project via the
// committed .env.local, filling its logs with fixture slugs like `t1`.
describe('E2E dev server never points at production', () => {
  const PROD_URL = `https://${'ixafegmxkadbzhxmepsd'}.supabase.co`

  async function loadConfig(env: Record<string, string>) {
    const saved = { ...process.env }
    for (const k of ['TEST_SUPABASE_URL', 'TEST_SUPABASE_KEY', 'E2E_PORT', 'NUXT_PUBLIC_SUPABASE_URL', 'NUXT_PUBLIC_SUPABASE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) delete process.env[k]
    Object.assign(process.env, env)
    try {
      vi.resetModules() // the config reads process.env at import time
      const { default: config } = await import('../playwright.config')
      return config.webServer.env as Record<string, string>
    } finally {
      process.env = saved
    }
  }

  test('overrides every Supabase URL/key the dev server reads, even when the shell has production values', async () => {
    const env = await loadConfig({ NUXT_PUBLIC_SUPABASE_URL: PROD_URL, VITE_SUPABASE_URL: PROD_URL })
    for (const k of ['NUXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL', 'NUXT_PUBLIC_SUPABASE_KEY', 'VITE_SUPABASE_ANON_KEY']) {
      expect(env[k], k).toBeTruthy()
    }
    expect(env.NUXT_PUBLIC_SUPABASE_URL).not.toMatch(HARDCODED_URL_RE)
    expect(env.VITE_SUPABASE_URL).not.toMatch(HARDCODED_URL_RE)
  })

  test('uses an explicit TEST_SUPABASE_URL when one is given (local Supabase)', async () => {
    const env = await loadConfig({ TEST_SUPABASE_URL: 'http://127.0.0.1:54321', TEST_SUPABASE_KEY: 'local-key' })
    expect(env.NUXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321')
    expect(env.VITE_SUPABASE_URL).toBe('http://127.0.0.1:54321')
    expect(env.VITE_SUPABASE_ANON_KEY).toBe('local-key')
  })

  test('does not default to :3000, where a normal (production-backed) dev server gets reused', async () => {
    const env = await loadConfig({})
    expect(env.PORT).not.toBe('3000')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CI: prerender only for deploys
// ─────────────────────────────────────────────────────────────────────────────
// Each `nuxt generate` makes ~2,700 Supabase requests; running it on every
// branch push was most of the project's log volume.
describe('CI prerenders only for deploys', () => {
  test('the build (nuxt generate) job is limited to main and manual runs', () => {
    const wf = read('.github/workflows/deploy.yml')
    const buildJob = wf.split(/\n  build:\n/)[1]!.split(/\n  \w+:\n/)[0]!
    expect(buildJob).toMatch(/\n    if: github\.ref == 'refs\/heads\/main' \|\| github\.event_name == 'workflow_dispatch'\n/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Hardcoded URL invariant
// ─────────────────────────────────────────────────────────────────────────────
describe('No hardcoded Supabase project URL', () => {
  const EXEMPT = new Set(['app/communication/http.ts', 'app/anon.ts'])

  test('only http.ts and anon.ts may reference the Supabase project ID', () => {
    const dirs = ['app']
    const violations: string[] = []
    for (const dir of dirs) {
      for (const file of collectTs(dir)) {
        if (EXEMPT.has(file)) continue
        if (HARDCODED_URL_RE.test(read(file))) violations.push(file)
      }
    }
    expect(violations).toEqual([])
  })

  test('http.ts reads the URL from VITE_SUPABASE_URL env var', () => {
    const src = read('app/communication/http.ts')
    expect(src).toContain('import.meta.env.VITE_SUPABASE_URL')
    expect(src).not.toMatch(HARDCODED_URL_RE)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// No dynamic server/api routes (CLAUDE.md: "No live Nitro server in production")
// ─────────────────────────────────────────────────────────────────────────────
// A dynamic segment (`[id]`, `[slug]`, ...) under server/api or server/routes
// only works in production if the `nuxt generate` prerender crawl happens to
// bake that exact value at build time — any id created or changed since the
// last deploy 404s silently at runtime, since there's no live Nitro server.
// This shipped once already: trails/[slug].vue depended on the now-deleted
// server/api/trail/[id].get.ts, and it broke production while every test
// passed, because tests/fixtures.ts mocked that route directly instead of
// ever exercising a real static build. Fetch Supabase REST directly instead
// (see getTrailById in app/communication/trails.ts for the replacement).
describe('No dynamic server/api routes', () => {
  // server/routes/_embed/[token].get.ts is the one legitimate exception:
  // /_embed/* is served by a separately-deployed Cloudflare Worker (see the
  // "Embed widget" line in CLAUDE.md's feature table and the CF embed
  // worker drift note in project memory), not by this Nuxt build's own
  // (nonexistent-in-prod) Nitro server. Any other addition here needs the
  // same kind of justification, spelled out in a comment next to it.
  const EXEMPT = new Set(['server/routes/_embed/[token].get.ts'])

  test('server/api and server/routes contain no unreviewed dynamic-segment routes', () => {
    const violations = [
      ...collectTs('server/api'),
      ...collectTs('server/routes'),
    ].filter(f => /\[[^\]]+\]/.test(f) && !EXEMPT.has(f))
    expect(violations).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Canonical URLs keep the trailing slash (GitHub Pages 301s the slashless form)
// ─────────────────────────────────────────────────────────────────────────────
// Use canonicalUrl()/canonicalPath() from app/utils/seo.ts instead of a literal.
describe('Page URLs end with a trailing slash', () => {
  test('no .vue file under app/pages hardcodes a trailradar.org URL without one', () => {
    const SLASHLESS_URL_RE = /https:\/\/trailradar\.org\/[a-z0-9\/-]*[a-z0-9-]['"`]/
    const violations = collectTs('app/pages')
      .filter(f => f.endsWith('.vue'))
      .filter(f => SLASHLESS_URL_RE.test(readFileSync(join(ROOT, f), 'utf8')))
    expect(violations).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// No orphaned content directories at repo root
// ─────────────────────────────────────────────────────────────────────────────
// `nuxt generate` only ships `.output/public`, which is `public/` copied
// verbatim plus prerendered app routes — a hand-built static mini-site left
// sitting directly at the repo root (a sibling of app/public/server, not
// inside public/) is completely invisible to the build and 404s in
// production for every one of its URLs. This exact bug shipped once already:
// a `spotchecks/` directory with its own index.html pages got orphaned at
// repo root during the Nuxt migration and 404'd at trailradar.org/spotchecks/*
// while every other check stayed green. See CLAUDE.md's "No live Nitro
// server in production" section and scripts/verify-static-build.mjs's
// /spotchecks/kulmbach/ check for the runtime-level regression test.
describe('No orphaned content directories at repo root', () => {
  // Known non-content directories at repo root: source trees Nuxt already
  // resolves (app, public, server), tooling/config/native-shell directories,
  // and build output. None of these are expected to contain a top-level
  // index.html of their own; if one ever does, it's either a false positive
  // to add here with justification, or a real orphaned static site like the
  // original spotchecks/ bug.
  const ALLOWED_TOP_LEVEL_DIRS = new Set([
    'app',
    'public',
    'server',
    'node_modules',
    '.git',
    '.claude',
    '.github',
    '.idea',
    '.nuxt',
    '.output',
    'dist',
    'ios',
    'android',
    'assets', // Capacitor native-shell icon/splash source assets, not web content
    'build', // build-time Nuxt hooks/config (build/region, etc.), not static content
    'cloudflare', // Worker source for /_embed, deployed separately (see CLAUDE.md)
    'docs',
    'scripts',
    'supabase',
    'tests',
  ])

  test('no stray top-level directory ships its own index.html outside the known content roots', () => {
    const entries = readdirSync(ROOT, { withFileTypes: true })
    const violations: string[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (ALLOWED_TOP_LEVEL_DIRS.has(entry.name)) continue
      try {
        statSync(join(ROOT, entry.name, 'index.html'))
        violations.push(entry.name)
      } catch { /* no index.html directly in this dir — fine */ }
    }
    expect(violations).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Build hooks never dirty tracked files
// ─────────────────────────────────────────────────────────────────────────────
// nuxt.config.ts's nitro:config hook also runs on `nuxt prepare` and `nuxt dev`
// (the test hook, e2e servers), so anything it writes into public/ shows up as
// a diff in every worktree and gets swept into unrelated commits — this
// happened repeatedly with public/sitemap.xml. Build-only artifacts belong in
// the prerender output (nitro.options.output.publicDir); a dev-time file under
// public/ must be gitignored.
describe('Build hooks never dirty tracked files', () => {
  test('every file nuxt.config.ts writes under public/ is gitignored', () => {
    const src = read('nuxt.config.ts')
    const written = [...src.matchAll(/writeFileSync\(\s*['"`](public\/[^'"`]+)['"`]/g)].map(m => m[1]!)
    const tracked = written.filter(f => {
      try {
        execFileSync('git', ['check-ignore', '-q', f], { cwd: ROOT })
        return false
      } catch { return true }
    })
    expect(tracked).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Single Responsibility: auth store owns auth only
// ─────────────────────────────────────────────────────────────────────────────
describe('Auth store (Single Responsibility)', () => {
  test('contains no image-processing or photo-upload logic', () => {
    const src = read('app/stores/auth.ts')
    expect(src, 'canvas API in auth store').not.toContain('canvas')
    expect(src, 'trail_photos table in auth store').not.toContain('trail_photos')
    expect(src, 'transformImage in auth store').not.toContain('transformImage')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Open/Closed: trail type dispatch uses a lookup table, not an if-chain
// ─────────────────────────────────────────────────────────────────────────────
describe('Trail type dispatch (Open/Closed)', () => {
  test('getTrailDetails uses the SPOT_TYPES registry, not if/else chain', () => {
    const src = read('app/communication/trails.ts')
    expect(src, 'registry lookup must exist').toContain('SPOT_TYPES[trail.type].detailsEndpoint')
    // The old if-chain pattern: `if (isDirtPark(trail))` in getTrailDetails
    expect(src, 'if-chain dispatch must be removed from getTrailDetails')
      .not.toMatch(/if\s*\(isDirtPark\(trail\)\)/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DRY: filter logic lives only in filtersStore
// ─────────────────────────────────────────────────────────────────────────────
describe('Filter logic (DRY / single source of truth)', () => {
  test('useTrailMap delegates to filtersStore.apply() rather than reimplementing filters', () => {
    const src = read('app/composables/useTrailMap.ts')
    expect(src, 'filtersStore.apply() must be called').toContain('filtersStore.apply(')
    expect(src, 'inline type-switch filter must not exist')
      .not.toMatch(/showTrails\s*\?\s*trails/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Embed page — self-contained, no store imports
// ─────────────────────────────────────────────────────────────────────────────
describe('Embed page (self-contained)', () => {
  test('embed page does not import from stores/', () => {
    const src = read('app/pages/embed/[token].vue')
    expect(src, 'embed page must not import stores directly').not.toMatch(/from\s+['"]([~@]\/)?stores\//)
  })

  test('embed page does not use useTrailMap (no store/filter machinery needed)', () => {
    const src = read('app/pages/embed/[token].vue')
    expect(src, 'embed page must not pull in useTrailMap').not.toContain('useTrailMap')
  })

  test('embed page renders via the shared mini-map renderer, not its own inline Leaflet', () => {
    const src = read('app/pages/embed/[token].vue')
    // Icon creation (markerIconOptions etc.) is now reached transitively
    // through ~/map/miniMap — the embed page must not init Leaflet itself.
    expect(src, 'embed page must use the shared createMiniMap').toContain('createMiniMap')
    expect(src, 'embed page must not import leaflet directly').not.toMatch(/from ['"]leaflet['"]/)
    expect(src, 'embed page must not call L.map itself').not.toMatch(/L\.map\(/)
  })

  test('useTrailMap uses shared markerIconOptions instead of inline icon creation', () => {
    const src = read('app/composables/useTrailMap.ts')
    expect(src, 'useTrailMap must import markerIconOptions').toContain('markerIconOptions')
    expect(src, 'useTrailMap must not inline the marker HTML').not.toContain('marker-wrapper')
  })

  test('server host validation utility has no browser dependencies', () => {
    const src = read('server/utils/embedHostValidation.ts')
    expect(src, 'must not import from stores').not.toMatch(/from\s+['"]([~@]\/)?stores\//)
    expect(src, 'must not import from composables').not.toMatch(/from\s+['"]([~@]\/)?composables\//)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// No dead UI code in the data layer
// ─────────────────────────────────────────────────────────────────────────────
describe('Communication layer has no UI concerns', () => {
  test('createCustomIcon is not exported from trails.ts', () => {
    const src = read('app/communication/trails.ts')
    expect(src).not.toMatch(/export\s+(async\s+)?function\s+createCustomIcon/)
    expect(src).not.toMatch(/export\s+const\s+createCustomIcon/)
  })

  test('soilReports.ts goes through FUNCTIONS/userHeaders, with no hardcoded URL or upward imports', () => {
    const src = read('app/communication/soilReports.ts')
    expect(src).toMatch(/import\s*\{[^}]*\bFUNCTIONS\b[^}]*\}\s*from\s*['"]\.\/http['"]/)
    expect(src).toMatch(/import\s*\{[^}]*\buserHeaders\b[^}]*\}\s*from\s*['"]\.\/http['"]/)
    expect(src).toContain('${FUNCTIONS}/soil-report')
    expect(src).not.toMatch(HARDCODED_URL_RE)
    expect(src).not.toMatch(/https?:\/\//)
    expect(src).not.toMatch(/from\s+['"]([~@]\/)?(stores|composables|map)\//)
  })

  test('communication/ does not import from stores/ or composables/', () => {
    const violations: string[] = []
    for (const file of collectTs('app/communication')) {
      const content = read(file)
      if (/from\s+['"]([~@]\/)?stores\//.test(content)) violations.push(`${file} → stores/`)
      if (/from\s+['"]([~@]\/)?composables\//.test(content)) violations.push(`${file} → composables/`)
    }
    expect(violations).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Segment editor — state stays inside SpotManagerApp.vue
// ─────────────────────────────────────────────────────────────────────────────
describe('Segment editor (architectural isolation)', () => {
  test('SpotManagerApp.vue does not import from app/map/ directly', () => {
    const src = read('app/components/spotmanager/SpotManagerApp.vue')
    expect(src, 'SpotManagerApp.vue must not import from app/map/ directly')
      .not.toMatch(/from\s+['"][^'"]*app\/map\//)
  })

  test('SpotManagerApp.vue dispatches on SPOT_CAPABILITIES, not on spot type', () => {
    const src = read('app/components/spotmanager/SpotManagerApp.vue')
    expect(src).toContain('SPOT_CAPABILITIES')
    // spot-type dispatch only; `details`-kind and GPX item-kind comparisons are capability lookups
    expect(src).not.toMatch(/\btype\s*===\s*['"](bikepark|dirtpark|trail)['"]/)
  })

  test('SpotManagerApp.vue derives back + breadcrumbs from viewTree.ts, not its own if-chains', () => {
    const src = read('app/components/spotmanager/SpotManagerApp.vue')
    expect(src).toContain('createViewNav(')
    expect(src).toContain('breadcrumbsFor(')
    expect(src).not.toMatch(/function stepBack\b/)
  })

  test('SpotManagerApp.vue cancel / in-view back buttons leave through nav, so the view tree’s cleanup runs', () => {
    const src = read('app/components/spotmanager/SpotManagerApp.vue')
    expect(src).not.toMatch(/@(click|cancel)="[^"]*view\s*=\s*'list'/)
    expect(src).not.toMatch(/\b(cancelImport|cancelEdit|cancelSegmentEditor)\b/)
    expect(src).not.toMatch(/@cancel="open(EmbedList|ParkingList)"/)
  })

  test('SpotManagerApp.vue loads a spot via spotEditorLoader.ts and imports GPX via importQueue.ts', () => {
    const src = read('app/components/spotmanager/SpotManagerApp.vue')
    expect(src).toContain('createSpotEditorLoader(')
    expect(src).toContain('createImportQueue(')
    // per-type fetches belong to the capability-driven loader
    expect(src).not.toMatch(/\b(getSpotTrails|getSpotTours|getSpotDetails|getParkDetails)\b/)
  })

  test('SpotManager navigation / loader / import modules stay pure (no stores, no Vue)', () => {
    for (const f of ['viewTree.ts', 'spotEditorLoader.ts', 'importQueue.ts']) {
      const src = read(`app/spot_manager/${f}`)
      expect(src, f).not.toMatch(/from\s+['"][^'"]*(stores|composables)\//)
      expect(src, f).not.toMatch(/from\s+['"]vue['"]/)
    }
  })

  test('GpxProcessor exports processSegment', () => {
    const src = read('app/spot_manager/GpxProcessor.ts')
    expect(src).toContain('export async function processSegment')
  })

  test('MapView exports showSourceTrack, updateLiveSlice, clearLiveSlice, clearSourceTrack', () => {
    const src = read('app/spot_manager/MapView.ts')
    expect(src).toContain('showSourceTrack(')
    expect(src).toContain('updateLiveSlice(')
    expect(src).toContain('clearLiveSlice(')
    expect(src).toContain('clearSourceTrack(')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Trail tooltip utility — pure, no browser/store/composable deps
// ─────────────────────────────────────────────────────────────────────────────
describe('trailTooltip utility (pure layer)', () => {
  test('trailTooltip.ts does not import from stores/ or composables/', () => {
    const src = read('app/map/trailTooltip.ts')
    expect(src).not.toMatch(/from\s+['"]([~@]\/)?stores\//)
    expect(src).not.toMatch(/from\s+['"]([~@]\/)?composables\//)
  })

  test('trailTooltip.ts does not import leaflet (no browser dep at module level)', () => {
    const src = read('app/map/trailTooltip.ts')
    expect(src).not.toMatch(/from\s+['"]leaflet/)
    expect(src).not.toMatch(/import\s+.*leaflet/)
  })

  test('trailTooltip.ts exports DIFF_COLOR, computeTrailStats, trailTooltipHtml, positionTooltip', () => {
    const src = read('app/map/trailTooltip.ts')
    expect(src).toContain('export const DIFF_COLOR')
    expect(src).toContain('export function computeTrailStats')
    expect(src).toContain('export function trailTooltipHtml')
    expect(src).toContain('export function positionTooltip')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Trail condition — the model and the weather source stay server-side
// ─────────────────────────────────────────────────────────────────────────────
// The verdict ("Hero Dirt", "Schlammig", ...) is computed by the `trail-condition`
// edge function (trailradar-backend), which also enforces the paid-tier gate.
// If the model or a direct Open-Meteo call creeps back into the client bundle,
// the gate is decorative again: anyone could read the model or skip the function.
describe('trail condition (server-side only)', () => {
  test('no client file imports the trail-condition model or weather codes', () => {
    const violations: string[] = []
    for (const file of collectTs('app')) {
      if (/\.test\.ts$/.test(file)) continue
      if (/from\s+['"][^'"]*\/(trailCondition|weatherCodes)['"]/.test(read(file))) violations.push(file)
    }
    expect(violations).toEqual([])
  })

  test('the client never calls the Open-Meteo API itself', () => {
    const violations: string[] = []
    for (const file of collectTs('app')) {
      if (/\.test\.ts$/.test(file)) continue
      // The attribution link (https://open-meteo.com/) is fine; an API URL is not.
      if (/open-meteo\.com\/v1|api\.open-meteo/.test(read(file))) violations.push(file)
    }
    expect(violations).toEqual([])
  })

  test('the condition fetch stays client-only, so nuxt generate cannot bake it in', () => {
    // A build-time fetch would freeze the build day's weather into the static
    // HTML until the next deploy — the same failure class as the prerendered
    // server/api route this project already shipped once.
    const src = read('app/composables/useTrailCondition.ts')
    expect(src).toMatch(/onMounted\(/)
    // Matches the call, not the mention — the file's own doc comment names
    // useAsyncData precisely to warn against it.
    expect(src).not.toMatch(/\buseAsyncData\s*\(/)
    expect(src).not.toMatch(/\buseFetch\s*\(/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Paid features — one gate (entitlements/gatedFetch.ts), one adapter per feature
// ─────────────────────────────────────────────────────────────────────────────
// The gate owns the entitlement check, 403 handling, the user-scoped cache and
// the stale guard. A paid feature that caches on its own drifts from that rule
// (Trail-Zustand's own cache once survived logout).
describe('paid features go through the gated-fetch module', () => {
  const adapters = ['app/communication/weather.ts', 'app/communication/soilMap.ts']

  test('each paid-feature communication file exports a GatedAdapter', () => {
    for (const file of adapters) expect(read(file), file).toMatch(/:\s*GatedAdapter</)
  })

  test('paid-feature communication files keep no cache of their own', () => {
    expect(adapters.filter(f => /localStorage/.test(read(f)))).toEqual([])
  })

  test('a sign-out sweeps every paid feature\'s cache, gate or no gate', () => {
    const sweep = read('app/plugins/paidCacheSweep.client.ts')
    for (const file of adapters) {
      const name = read(file).match(/export const (\w+):\s*GatedAdapter</)?.[1]
      expect(sweep, `${file}'s adapter`).toMatch(new RegExp(`\\b${name}\\b`))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Mini-map renderer — owns Leaflet, but only dynamically and only in a function
// ─────────────────────────────────────────────────────────────────────────────
// app/map/miniMap.ts is the read-only Leaflet renderer shared by the
// spot-detail page (SpotDetailMiniMap.vue) and the third-party embed page.
// It is allowed to own an `L` instance (like useTrailMap), but leaflet +
// leaflet-gesture-handling must be pulled in dynamically inside createMiniMap
// so they never reach the entry bundle, and it must stay off the store /
// composable layers.
describe('miniMap renderer (owns Leaflet, dynamically)', () => {
  test('miniMap.ts does not import from stores/ or composables/', () => {
    const src = read('app/map/miniMap.ts')
    expect(src).not.toMatch(/from\s+['"]([~@]\/)?stores\//)
    expect(src).not.toMatch(/from\s+['"]([~@]\/)?composables\//)
  })

  test('miniMap.ts imports leaflet only via a dynamic import(), never at module level', () => {
    const src = read('app/map/miniMap.ts')
    expect(src, 'must dynamic-import leaflet').toMatch(/import\(['"]leaflet['"]\)/)
    expect(src, 'must dynamic-import leaflet-gesture-handling').toMatch(/import\(['"]leaflet-gesture-handling['"]\)/)
    expect(src, 'no top-level leaflet import').not.toMatch(/^import .*from ['"]leaflet['"]/m)
  })

  test('miniMap.ts reuses the shared app/map helpers instead of duplicating them', () => {
    const src = read('app/map/miniMap.ts')
    expect(src).toMatch(/from ['"]\.\/trailTooltip['"]/)
    expect(src).toMatch(/from ['"]\.\/markerIcon['"]/)
    expect(src).toMatch(/from ['"]\.\/gpxZoomThreshold['"]/)
  })

  test('miniMap.ts exposes createMiniMap and the pure decision helpers', () => {
    const src = read('app/map/miniMap.ts')
    expect(src).toContain('export async function createMiniMap')
    expect(src).toContain('export function orderPolylines')
    expect(src).toContain('export function resolveShowGpx')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Boden-Radar map files stay free of app state
// ─────────────────────────────────────────────────────────────────────────────
describe('app/map/soil* files', () => {
  const files = collectTs('app/map').filter(f => /\/soil[^/]*\.ts$/.test(f) && !f.endsWith('.test.ts'))

  test('the soil map modules exist (guards the glob below)', () => {
    expect(files.length).toBeGreaterThanOrEqual(3)
  })

  test('import no stores, composables or components (state is injected by useTrailMap)', () => {
    const violations = files.filter(f =>
      /from\s+['"]([~@]\/|\.\.?\/)+(stores|composables|components)\//.test(read(f)))
    expect(violations).toEqual([])
  })

  test('never import leaflet at module level (injected / type-only)', () => {
    const violations = files.filter(f => /^import\s+(?!type\b)[^\n]*from\s+['"]leaflet/m.test(read(f)))
    expect(violations).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Marker presentation: pure view model, useTrailMap only applies it to Leaflet
// ─────────────────────────────────────────────────────────────────────────────
describe('app/map/markerPresentation.ts', () => {
  const src = read('app/map/markerPresentation.ts')

  test('imports no leaflet (not even type-only), stores, composables or components', () => {
    expect(src).not.toMatch(/from\s+['"]leaflet/)
    expect(src).not.toMatch(/from\s+['"]([~@]\/|\.\.?\/)+(stores|composables|components)\//)
  })

  test('soil range matching lives here, not in the filters store', () => {
    expect(src).toMatch(/export function soilMatch\(/)
    expect(read('app/stores/filters.ts')).not.toMatch(/soilMatch/)
  })

  test('useTrailMap takes pin icons / ghosting from the module instead of inlining soil rules', () => {
    const map = read('app/composables/useTrailMap.ts')
    expect(map).toMatch(/from '~\/map\/markerPresentation'/)
    expect(map, 'soil rules must not be re-derived in the composable').not.toMatch(/soilMarkerState|soilMatch|markerWithSoilBadgeOptions/)
  })
})

describe('Soil icons live as SVG files', () => {
  const LEVELS = ['dusty', 'dry', 'prime', 'damp', 'wet', 'raining', 'snow']
  const ICONS = [
    ...LEVELS.map(l => `app/assets/icons/soil/${l}.svg`),
    'app/assets/icons/spade.svg', 'app/assets/icons/lock.svg', 'app/assets/icons/radar.svg',
  ]
  const USERS = [
    'app/map/soilBadge.ts',
    'app/components/trail_detail/SpotDetailWeather.vue',
    'app/components/trail_detail/SpotDetailWeatherLocked.vue',
    'app/components/map/SoilRadarButton.vue',
    'app/components/map/SoilRadarPanel.vue',
  ]

  test('every soil glyph and UI icon has its own file under app/assets/icons', () => {
    const missing = ICONS.filter(f => { try { return !read(f).trim().startsWith('<svg') } catch { return true } })
    expect(missing).toEqual([])
  })

  test('the soil components and soilBadge.ts carry no inline <svg> drawings', () => {
    // Shapes or a viewBox mean a drawing; adding a class to a loaded file's <svg> tag is fine.
    const violations = USERS.filter(f => /<(path|circle|rect|line|polyline|polygon|ellipse)\s|<svg[^>]*viewBox/.test(read(f)))
    expect(violations).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Spot-type facts live in the SPOT_TYPES registry only
// ─────────────────────────────────────────────────────────────────────────────
// A new spot type used to touch 9 files because each re-spelled the type →
// table → details-table mapping. Raw table-name literals outside the registry
// (app/types/SpotTypes.ts) re-introduce that scatter — read SPOT_TYPES[...].table.
describe('Spot table names come from the SPOT_TYPES registry', () => {
  const TABLE_LITERAL_RE = /(['"`/])(dirt_parks|parks|bike_park_details|dirt_park_details)\b(?=['"`?]|\/?\s)/
  // Justified exemptions (path → why). Keep this list short.
  const EXEMPT: Record<string, string> = {
    'app/types/SpotTypes.ts': 'the registry itself',
    'nuxt.config.ts': 'build-time prerender fetch + service-worker URL regexes run outside the app bundle',
  }

  test('no raw park/dirt_park table-name literals outside the registry', () => {
    const files = [
      ...collectTs('app'), ...collectTs('server'), ...collectTs('build'), 'nuxt.config.ts',
    ].filter(f => !/\.test\.ts$/.test(f) && !(f in EXEMPT))
    const violations = files.filter(f => TABLE_LITERAL_RE.test(read(f)))
    expect(violations).toEqual([])
  })
})
