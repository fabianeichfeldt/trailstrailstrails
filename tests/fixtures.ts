import { test as base, expect as playwrightExpect, Page } from '@playwright/test';

// slug === id in the fixtures so tests can keep navigating to /trails/t1 and
// have it resolve straight through getTrailBySlug().
export const MOCK_TRAILS = [
  { id: 't1', slug: 't1', name: 'Flowtrail Tegernsee', type: 'trail', latitude: 47.71, longitude: 11.76, approved: true, creator: '', url: '', instagram: '', spotcheck: '', created_at: '2024-01-01' },
  { id: 't2', slug: 't2', name: 'Waldpfad Ingolstadt',  type: 'trail', latitude: 48.76, longitude: 11.42, approved: true, creator: '', url: '', instagram: '', spotcheck: '', created_at: '2024-01-02' },
  { id: 't3', slug: 't3', name: 'Schotterpiste',         type: 'trail', latitude: 48.10, longitude: 11.60, approved: false, creator: '', url: '', instagram: '', spotcheck: '', created_at: '2024-01-03' },
];

export const MOCK_BIKEPARKS = [
  { id: 'b1', slug: 'b1', name: 'Bikepark Lenggries', type: 'bikepark', latitude: 47.68, longitude: 11.56, approved: true, creator: '', url: '', instagram: '', spotcheck: '', created_at: '2024-01-01' },
];

export const MOCK_DIRTPARKS = [
  { id: 'd1', slug: 'd1', name: 'Pumptrack München', type: 'dirtpark', latitude: 48.14, longitude: 11.57, approved: true, creator: '', url: '', instagram: '', spotcheck: '', created_at: '2024-01-01', pumptrack: true, dirtpark: false },
];

/** Fake authenticated user returned by all auth mocks in logged-in state. */
export const MOCK_USER = {
  id: 'mock-user-id',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: '2024-01-01T00:00:00.000000Z',
  confirmed_at: '2024-01-01T00:00:00.000000Z',
  last_sign_in_at: '2024-01-01T00:00:00.000000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { name: 'TestRider', avatar_url: '' },
  identities: [],
  created_at: '2024-01-01T00:00:00.000000Z',
  updated_at: '2024-01-01T00:00:00.000000Z',
};

/**
 * Supabase JS v2 token endpoint response format.
 * Returned by POST /auth/v1/token on successful sign-in or token refresh.
 */
export const MOCK_SESSION = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: MOCK_USER,
};

/**
 * Simulates a Google OAuth user where sub (Google numeric subject) differs from
 * id (Supabase UUID). The DB stores user.id — using user.sub would miss the row.
 */
export const MOCK_GOOGLE_USER = {
  ...MOCK_USER,
  id: 'supabase-uuid-google-user',
  sub: '10293847561234567890',
  app_metadata: { provider: 'google', providers: ['google'] },
  user_metadata: { name: 'GoogleRider', avatar_url: '' },
};

export const MOCK_GOOGLE_SESSION = {
  ...MOCK_SESSION,
  user: MOCK_GOOGLE_USER,
};

const TRAIL_DETAILS_MOCK = {
  data: { id: 'mock', rules: [], description: '', last_update: '2024-01-01', opening_hours: '', trail_description: '', photos: [], videos: [], likes: [] },
};

/**
 * Open-Meteo payload for the spot weather card. Six days ending "today",
 * generated at run time so the data always lands inside the balance window —
 * a frozen date would drift out of it and silently turn every spot's verdict
 * into "no card".
 *
 * Mild and dry, so the card renders its "Hero Dirt" state and no test has to
 * care about it unless it wants to.
 */
function mockWeather() {
  // Ten past days + today + three forecast days, matching PAST_DAYS /
  // FORECAST_DAYS in app/communication/weather.ts. The strip renders a
  // seven-day window centred on today out of this.
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (10 - i));
    return d.toISOString().slice(0, 10);
  });
  const time: string[] = [];
  const hourlyRain: number[] = [];
  dates.forEach((date, dayIndex) => {
    for (let h = 0; h < 24; h++) {
      time.push(`${date}T${String(h).padStart(2, '0')}:00`);
      hourlyRain.push(dayIndex === 8 && h === 12 ? 4 : 0);
    }
  });
  return {
    utc_offset_seconds: 0,
    timezone: 'UTC',
    elevation: 700,
    current: {
      temperature_2m: 12, apparent_temperature: 10,
      weather_code: 2, precipitation: 0, wind_speed_10m: 13,
    },
    daily: {
      time: dates,
      // 4mm two days ago: enough to reset the drying counter so the verdict
      // sits solidly in "Hero Dirt" rather than on the dust threshold, where a
      // rain-free fixture lands by coincidence.
      weather_code: dates.map((_, i) => (i === 8 ? 61 : 2)),
      precipitation_sum: dates.map((_, i) => (i === 8 ? 4 : 0)),
      temperature_2m_max: dates.map(() => 18),
      temperature_2m_min: dates.map(() => 9),
      et0_fao_evapotranspiration: dates.map(() => 2),
      snowfall_sum: dates.map(() => 0),
    },
    hourly: {
      time,
      precipitation: hourlyRain,
      snowfall: time.map(() => 0),
    },
  };
}

const MOCK_ACTIVITY = [
  { type: 'spot', trailId: 't3', name: 'Schotterpiste',       created_at: '2024-01-03' },
  { type: 'spot', trailId: 't2', name: 'Waldpfad Ingolstadt', created_at: '2024-01-02' },
  { type: 'spot', trailId: 't1', name: 'Flowtrail Tegernsee', created_at: '2024-01-01' },
];

/**
 * Step 1 — Safety net.
 *
 * Registered FIRST so it has the LOWEST priority.
 * Playwright matches routes in reverse-registration order, so any specific mock
 * added after this (via setupApiMocks) will override it for that URL.
 *
 * Any external HTTP/HTTPS request that falls through to this handler was NOT
 * covered by a specific mock — it would have hit production. We block it and
 * collect the URL so the test can fail with a clear message.
 *
 * Returns `assertNoLeaks()` — call this after the test body to fail loudly
 * if anything slipped through.
 */
export async function applySafetyNet(page: Page): Promise<() => void> {
  const blocked: string[] = [];

  await page.route(
    (url) =>
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      url.hostname !== 'localhost' &&
      url.hostname !== '127.0.0.1',
    (route) => {
      blocked.push(`${route.request().method()} ${route.request().url()}`);
      route.abort('failed');
    },
  );

  return () => {
    if (blocked.length > 0) {
      throw new Error(
        `[SAFETY] ${blocked.length} unmocked external request(s) would have reached production.\n` +
        `Add a mock in setupApiMocks() for each of these:\n` +
        blocked.map((u) => `  • ${u}`).join('\n'),
      );
    }
  };
}

/**
 * Step 2 — Specific mocks.
 *
 * Registered AFTER the safety net, so these take precedence over it.
 * Every known external URL the app contacts must be listed here.
 */
export async function setupApiMocks(page: Page) {
  // Nuxt server API routes
  await page.route('**/api/activity',              (route) => route.fulfill({ json: MOCK_ACTIVITY }));
  // Supabase REST API
  await page.route('**/rest/v1/trails**',          (route) => route.fulfill({ json: MOCK_TRAILS }));
  await page.route('**/rest/v1/parks**',            (route) => route.fulfill({ json: MOCK_BIKEPARKS }));
  await page.route('**/rest/v1/dirt_parks**',       (route) => route.fulfill({ json: MOCK_DIRTPARKS }));
  await page.route('**/rest/v1/trail_photos**',     (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/spot_comments**',    (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/trail_favorites**',  (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/spot_gpx_trails**',  (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/spot_gpx_tours**',   (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/parking**',          (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/trailcrew_spots**',  (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/trail_details**',    (route) => route.fulfill({ json: [] }));
  // Supabase RPC calls (e.g. get_my_role). Return null — auth store defaults to 'user'.
  await page.route('**/rest/v1/rpc/**',             (route) => route.fulfill({ json: null }));
  // Supabase Edge Functions (trail details, visit counter, etc.)
  await page.route('**/functions/v1/**',            (route) => route.fulfill({ json: TRAIL_DETAILS_MOCK }));
  // Supabase Auth — catch-all: no session by default
  await page.route('**/auth/v1/**',                 (route) => route.fulfill({ json: { data: { session: null, user: null }, error: null } }));
  // IP geolocation
  await page.route('**/trailradar.org/geo',         (route) => route.fulfill({ json: { lat: 48.1, lon: 11.5 } }));
  // Nominatim — empty by default so tests only see trail results, not place suggestions
  await page.route('**/nominatim.openstreetmap.org/**', (route) => route.fulfill({ json: [] }));
  // Spot weather (Trail-Zustand card on /trails/[slug])
  await page.route('**/api.open-meteo.com/**',      (route) => route.fulfill({ json: mockWeather() }));
  // OSM map tiles — abort; not needed for logic tests
  await page.route('**tile.openstreetmap.org/**',   (route) => route.abort());
  await page.route('**tile.tracestrack.com/**',   (route) => route.abort());
  // Leaflet default marker icon fetched from unpkg CDN
  await page.route('**unpkg.com/**',                (route) => route.abort());
  await page.route('**opentopodata.org/**',          (route) => route.abort());
}

/**
 * Convenience: safety net + specific mocks in one call.
 * Used by baseTest tests that navigate to a custom URL on first load.
 * Returns assertNoLeaks() for the caller to invoke after the test body.
 */
export async function setupAllMocks(page: Page): Promise<() => void> {
  const assertNoLeaks = await applySafetyNet(page); // lowest priority — must come first
  await setupApiMocks(page);                         // higher priority — overrides safety net
  return assertNoLeaks;
}

/**
 * Sign in via the AuthModal embedded on the /profile page: the modal opens from the
 * "Anmelden" button on the not-logged-in banner, and after sign-in the Vue reactive
 * state updates — no page reload. Auth state therefore lives in memory, so a test
 * that needs a signed-in user on another page must navigate client-side afterwards
 * (see `navigateClientSide`), not with `page.goto`.
 *
 * Must be called AFTER `setupAllMocks(page)` and AFTER `page.goto('/profile')`. Mock
 * anything the sign-in triggers (e.g. the entitlement RPC) BEFORE calling it.
 */
export async function signInOnProfilePage(page: Page) {
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: MOCK_SESSION }));
  await page.route('**/auth/v1/user**',  (route) => route.fulfill({ json: MOCK_USER }));

  await page.locator('.not-logged-in button').click();  // "Anmelden" button
  await page.locator('.auth-card input[autocomplete="email"]').fill('test@example.com');
  await page.locator('.auth-card input[autocomplete="current-password"]').fill('password123');
  await page.locator('.auth-card button[type="submit"]').click();
  // Wait for modal to close — sign-in success
  await playwrightExpect(page.locator('.auth-card')).not.toBeVisible({ timeout: 6000 });
  // Wait for profile content to appear reactively
  await playwrightExpect(page.locator('.profile-layout')).toBeVisible({ timeout: 6000 });
}

/** SPA navigation through the Nuxt router, keeping in-memory state (e.g. a signed-in user). */
export async function navigateClientSide(page: Page, path: string) {
  await page.evaluate((to) => (window as unknown as { useNuxtApp: () => { $router: { push: (p: string) => Promise<void> } } }).useNuxtApp().$router.push(to), path);
}

/** Fixture: safety net + mocks + navigated to /map + networkidle. */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const assertNoLeaks = await setupAllMocks(page);
    await page.goto('/map');
    await page.waitForLoadState('networkidle');
    await use(page);
    assertNoLeaks(); // fails the test if any external URL slipped through
  },
});

export { expect } from '@playwright/test';
