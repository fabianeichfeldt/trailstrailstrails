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

const supabaseUrl = process.env.TEST_SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.TEST_SUPABASE_KEY || process.env.NUXT_PUBLIC_SUPABASE_KEY || ''

// Port is overridable because `reuseExistingServer` + a hardcoded 3000 is a
// trap in this repo: work happens in git worktrees (see CLAUDE.md), and a
// `nuxt dev` left running in the primary checkout will happily serve every
// worktree's E2E run. The suite then passes or fails against code from a
// completely different branch, with nothing in the output saying so.
// Set E2E_PORT to give a worktree its own server.
const PORT = process.env.E2E_PORT || '3000'
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
    // Forward Supabase config to the dev server process so it connects to the
    // right instance (local or production) without mutating .env.local.
    env: {
      PORT,
      ...(supabaseUrl && { NUXT_PUBLIC_SUPABASE_URL: supabaseUrl }),
      ...(supabaseKey && { NUXT_PUBLIC_SUPABASE_KEY: supabaseKey }),
    },
  },
})
