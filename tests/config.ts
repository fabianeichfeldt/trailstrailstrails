// Supabase connection config for tests.
// To target a local Supabase instance, set these env vars in .env.test or your shell
// before running `npx playwright test`:
//
//   TEST_SUPABASE_URL=http://localhost:54321
//   TEST_SUPABASE_KEY=<local-anon-key>
//
// The dev server started by Playwright will then connect to that instance.
// Route mocks in fixtures.ts use wildcard patterns, so they work regardless of URL.
export const supabaseUrl =
  process.env.TEST_SUPABASE_URL ||
  process.env.NUXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''

export const supabaseAnonKey =
  process.env.TEST_SUPABASE_KEY ||
  process.env.NUXT_PUBLIC_SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
