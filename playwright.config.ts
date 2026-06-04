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

export default defineConfig({
  testDir: './tests',
  timeout: 15000,
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    // Forward Supabase config to the dev server process so it connects to the
    // right instance (local or production) without mutating .env.local.
    env: {
      ...(supabaseUrl && { NUXT_PUBLIC_SUPABASE_URL: supabaseUrl }),
      ...(supabaseKey && { NUXT_PUBLIC_SUPABASE_KEY: supabaseKey }),
    },
  },
})
