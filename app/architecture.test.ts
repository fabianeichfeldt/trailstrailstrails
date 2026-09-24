// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

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
  test('getTrailDetails uses DETAIL_ENDPOINT lookup, not if/else chain', () => {
    const src = read('app/communication/trails.ts')
    expect(src, 'DETAIL_ENDPOINT lookup table must exist').toContain('DETAIL_ENDPOINT')
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
