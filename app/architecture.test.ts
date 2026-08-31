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

  test('embed page uses shared markerIconOptions instead of inline icon creation', () => {
    const src = read('app/pages/embed/[token].vue')
    expect(src, 'embed page must import markerIconOptions').toContain('markerIconOptions')
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
