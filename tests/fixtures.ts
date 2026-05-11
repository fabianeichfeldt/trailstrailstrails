import { test as base, Page } from '@playwright/test';

export const MOCK_TRAILS = [
  { id: 't1', name: 'Flowtrail Tegernsee', type: 'trail', latitude: 47.71, longitude: 11.76, approved: true, creator: '', url: '', instagram: '', spotcheck: '', created_at: '2024-01-01' },
  { id: 't2', name: 'Waldpfad Ingolstadt',  type: 'trail', latitude: 48.76, longitude: 11.42, approved: true, creator: '', url: '', instagram: '', spotcheck: '', created_at: '2024-01-02' },
  { id: 't3', name: 'Schotterpiste',         type: 'trail', latitude: 48.10, longitude: 11.60, approved: false, creator: '', url: '', instagram: '', spotcheck: '', created_at: '2024-01-03' },
];

export const MOCK_BIKEPARKS = [
  { id: 'b1', name: 'Bikepark Lenggries', type: 'bikepark', latitude: 47.68, longitude: 11.56, approved: true, creator: '', url: '', instagram: '', spotcheck: '', created_at: '2024-01-01' },
];

export const MOCK_DIRTPARKS = [
  { id: 'd1', name: 'Pumptrack München', type: 'dirtpark', latitude: 48.14, longitude: 11.57, approved: true, creator: '', url: '', instagram: '', spotcheck: '', created_at: '2024-01-01', pumptrack: true, dirtpark: false },
];

const TRAIL_DETAILS_MOCK = {
  data: { id: 'mock', rules: [], description: '', last_update: '2024-01-01', opening_hours: '', trail_description: '', photos: [], videos: [], likes: [] },
};

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
  // Supabase REST API
  await page.route('**/rest/v1/trails**',       (route) => route.fulfill({ json: MOCK_TRAILS }));
  await page.route('**/rest/v1/parks**',         (route) => route.fulfill({ json: MOCK_BIKEPARKS }));
  await page.route('**/rest/v1/dirt_parks**',    (route) => route.fulfill({ json: MOCK_DIRTPARKS }));
  await page.route('**/rest/v1/trail_photos**',  (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/spot_gpx_trails**', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/spot_gpx_tours**',  (route) => route.fulfill({ json: [] }));
  // Supabase Edge Functions (trail details, visit counter, etc.)
  await page.route('**/functions/v1/**',         (route) => route.fulfill({ json: TRAIL_DETAILS_MOCK }));
  // Supabase Auth
  await page.route('**/auth/v1/**',              (route) => route.fulfill({ json: { data: { session: null, user: null }, error: null } }));
  // IP geolocation
  await page.route('**/trailradar.org/geo',      (route) => route.fulfill({ json: { lat: 48.1, lon: 11.5 } }));
  // Nominatim — empty by default so tests only see trail results, not place suggestions
  await page.route('**/nominatim.openstreetmap.org/**', (route) => route.fulfill({ json: [] }));
  // OSM map tiles — abort; not needed for logic tests
  await page.route('**tile.openstreetmap.org/**', (route) => route.abort());
  // Leaflet default marker icon fetched from unpkg CDN
  await page.route('**unpkg.com/**', (route) => route.abort());
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

/** Fixture: safety net + mocks + navigated to / + networkidle. */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, use) => {
    const assertNoLeaks = await setupAllMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await use(page);
    assertNoLeaks(); // fails the test if any external URL slipped through
  },
});

export { expect } from '@playwright/test';
