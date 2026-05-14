// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Resolve project root relative to this file (src/architecture.test.ts → ../)
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
  const EXEMPT = new Set(['src/communication/http.ts', 'src/anon.ts'])

  test('only http.ts and anon.ts may reference the Supabase project ID', () => {
    const dirs = ['src', 'stores', 'composables', 'server']
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
    const src = read('src/communication/http.ts')
    expect(src).toContain('import.meta.env.VITE_SUPABASE_URL')
    expect(src).not.toMatch(HARDCODED_URL_RE)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Single Responsibility: auth store owns auth only
// ─────────────────────────────────────────────────────────────────────────────
describe('Auth store (Single Responsibility)', () => {
  test('contains no image-processing or photo-upload logic', () => {
    const src = read('stores/auth.ts')
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
    const src = read('src/communication/trails.ts')
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
    const src = read('composables/useTrailMap.ts')
    expect(src, 'filtersStore.apply() must be called').toContain('filtersStore.apply(')
    expect(src, 'inline type-switch filter must not exist')
      .not.toMatch(/showTrails\s*\?\s*trails/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// No dead UI code in the data layer
// ─────────────────────────────────────────────────────────────────────────────
describe('Communication layer has no UI concerns', () => {
  test('createCustomIcon is not exported from trails.ts', () => {
    const src = read('src/communication/trails.ts')
    expect(src).not.toMatch(/export\s+(async\s+)?function\s+createCustomIcon/)
    expect(src).not.toMatch(/export\s+const\s+createCustomIcon/)
  })

  test('communication/ does not import from stores/ or composables/', () => {
    const violations: string[] = []
    for (const file of collectTs('src/communication')) {
      const content = read(file)
      if (/from\s+['"]([~@]\/)?stores\//.test(content)) violations.push(`${file} → stores/`)
      if (/from\s+['"]([~@]\/)?composables\//.test(content)) violations.push(`${file} → composables/`)
    }
    expect(violations).toEqual([])
  })
})
