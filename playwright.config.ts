import { defineConfig } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

// Load .env.test if present — lets you point tests at a local Supabase instance
// without touching .env.local (which is used for normal dev).
if (existsSync('.env.test')) {
  readFileSync('.env.test', 'utf8').split('\n').forEach(line => {
    const eq = line.indexOf('=')
    if (eq > 0) {
      const key = line.slice(0, eq).trim()
      if (!process.env[key]) process.env[key] = line.slice(eq + 1).trim()
    }
  })
}

// Never inherit the committed .env.local (production): the dev server's own SSR
// fetches bypass the browser-side mocks. Same placeholder host as CI.
const supabaseUrl = process.env.TEST_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.TEST_SUPABASE_KEY || 'placeholder-anon-key'

// Port is overridable because `reuseExistingServer` + a hardcoded 3000 is a
// trap in this repo: work happens in git worktrees (see CLAUDE.md), and a
// `nuxt dev` left running in the primary checkout will happily serve every
// worktree's E2E run. The suite then passes or fails against code from a
// completely different branch, with nothing in the output saying so.
// Not 3000 by default, so a normal (production-backed) dev server is never reused.
// Set E2E_PORT to give a worktree its own server.
const PORT = process.env.E2E_PORT || '3100'
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests',
  // CI boots a cold `nuxt dev` (reuseExistingServer is false there) and Vite
  // compiles each route on first request — the trail-detail page plus its
  // embedded /embed/[token] iframe is the heaviest pair in the suite and a
  // cold compile on a 2-core runner routinely blew the old 15s budget.
  // globalSetup below pre-compiles the hot routes so no timed test pays that
  // toll; this stays generous for the odd slow navigation regardless.
  timeout: 30000,
  expect: { timeout: 15000 },
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
  },
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    // First cold `nuxt dev` boot on CI (install already done) can crawl past
    // 30s before it serves; give it room.
    timeout: 120000,
    // Process env wins over .env.local for both Nuxt (NUXT_PUBLIC_*) and Vite
    // (VITE_*, read by communication/http.ts), so neither falls back to production.
    env: {
      PORT,
      E2E: '1',
      NUXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NUXT_PUBLIC_SUPABASE_KEY: supabaseKey,
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: supabaseKey,
    },
  },
})
