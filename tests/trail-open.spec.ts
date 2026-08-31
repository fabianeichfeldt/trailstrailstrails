import { test as baseTest } from '@playwright/test';
import { test, expect, setupAllMocks, MOCK_TRAILS } from './fixtures';

// Decodes an OSM tile request URL (.../{z}/{x}/{y}.png) back to the
// lat/lng/zoom it covers — lets a test prove the live map actually flew to
// a given spot without needing to expose the Leaflet instance to the page.
function decodeTileUrl(url: string): { z: number; lat: number; lng: number } | null {
  const match = url.match(/\/(\d+)\/(\d+)\/(\d+)\.png/);
  if (!match) return null;
  const [, zStr, xStr, yStr] = match;
  const z = Number(zStr);
  const n = 2 ** z;
  const lng = Number(xStr) / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * Number(yStr) / n))) * 180 / Math.PI;
  return { z, lat, lng };
}

function trackTileRequests(page: import('@playwright/test').Page): string[] {
  const tileUrls: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('tile.openstreetmap.org')) tileUrls.push(req.url());
  });
  return tileUrls;
}

// ── Via ?trail= query param ────────────────────────────────────────────────────
// The news cards on the landing page link to /map?trail=ID. The map page
// reads this query param on mount and flies the still-live map to that
// spot's coordinates and zooms in — it stays on /map. Only clicking the
// spot's own marker (see the "marker click" tests further down) opens its
// detail page; see useTrailMap.ts's openTrailFn.

baseTest('/map?trail= flies the live map to the spot\'s coordinates without navigating', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  const tileUrls = trackTileRequests(page);

  await page.goto('/map?trail=t1');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500); // let the flyTo animation finish and its tiles fire

  await expect(page).toHaveURL(/\/map(\?|$)/);
  const flownTiles = tileUrls.map(decodeTileUrl).filter((t): t is NonNullable<typeof t> => t?.z === 14);
  expect(flownTiles.length).toBeGreaterThan(0);
  // t1's fixture coordinates (tests/fixtures.ts)
  expect(flownTiles.some(t => Math.abs(t.lat - 47.71) < 0.05 && Math.abs(t.lng - 11.76) < 0.05)).toBe(true);
  assertNoLeaks();
});

baseTest('/map?trail= works for a bikepark', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  const tileUrls = trackTileRequests(page);

  await page.goto('/map?trail=b1');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  await expect(page).toHaveURL(/\/map(\?|$)/);
  const flownTiles = tileUrls.map(decodeTileUrl).filter((t): t is NonNullable<typeof t> => t?.z === 14);
  expect(flownTiles.length).toBeGreaterThan(0);
  // b1's fixture coordinates (tests/fixtures.ts)
  expect(flownTiles.some(t => Math.abs(t.lat - 47.68) < 0.05 && Math.abs(t.lng - 11.56) < 0.05)).toBe(true);
  assertNoLeaks();
});

// ── Trail detail page ──────────────────────────────────────────────────────────
// /trails/[id] is the full spot-detail page (evolved from a thin static SEO
// shell — see app/pages/trails/[slug].vue and tests/trails-detail-page.spec.ts
// for its section coverage). The "View on map" CTA now flies the live map
// to the spot's coordinates (Decision 10 of the spec) instead of reopening
// a panel via ?trail=.

baseTest('/trails/[id] shows the trail name and a "View on map" link that flies to its coordinates', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('h1')).toContainText('Flowtrail Tegernsee');
  await expect(page.locator('a[href="/map?fly=47.71,11.76"]').first()).toBeVisible();
  assertNoLeaks();
});

// Regression test for "the embedded map on a trail page shows the wrong
// location" (reported: /trails/[uuid] pages showing a map centered near
// Salzburg — the DEFAULT_LAT/DEFAULT_LNG fallback in app/utils/embedQuery.ts
// — instead of the trail's actual coordinates). Nothing previously asserted
// on the <iframe class="trail-map"> element at all: the only existing test
// above only checks the h1 and the "open in map" link, both of which are
// derived from the slug/name and would stay green even if the iframe's
// src carried completely wrong (or default) coordinates. This test follows
// the full first-party chain that was actually broken in production:
// trail.latitude/longitude (app/pages/trails/[slug].vue) -> the embedSrc
// computed -> the rendered <iframe src>.
baseTest('/trails/[id] embeds a map centered on the trail\'s own coordinates, not the embed-query default', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');

  const src = await page.locator('iframe.trail-map').getAttribute('src');
  expect(src).toBeTruthy();

  // t1's fixture coordinates (tests/fixtures.ts) — well clear of Salzburg
  // (lat 47.8, lng 13.0) so a fallback-to-default regression is unmistakable.
  expect(src).toContain('lat=47.71');
  expect(src).toContain('lng=11.76');
  expect(src).not.toContain('lat=47.8&');
  expect(src).not.toContain('lng=13');

  assertNoLeaks();
});

// This page (app/pages/trails/[slug].vue) also renders region overview
// pages through the exact same component and iframe-building logic
// (regionEmbedSrc) — same guard, different data source (a static region
// table instead of a fetched trail), covering the two branches that feed
// the same "wrong map" failure mode.
baseTest('/trails/[region] embeds a map centered on that region, not the embed-query default', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/allgaeu');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('h1')).toHaveText('Trails im Allgäu');
  const src = await page.locator('iframe.region-map').getAttribute('src');
  expect(src).toBeTruthy();
  // build/region.ts: allgaeu = { lat: 47.60, lng: 10.30 }
  expect(src).toContain('lat=47.6');
  expect(src).toContain('lng=10.3');

  assertNoLeaks();
});

// Guards against stale data surviving a client-side (no full reload)
// navigation between two pages matched by the same [slug].vue component —
// e.g. via the "Weitere Regionen" links. If trail/region data were ever
// keyed off something that doesn't update on navigation, the embedded map
// (and the rest of the page) would get stuck showing the FIRST page visited
// in a browsing session, no matter which URL is now in the address bar.
baseTest('/trails/[slug] refreshes the embedded map location on client-side navigation between pages', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/allgaeu');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('h1')).toHaveText('Trails im Allgäu');
  await expect(page.locator('iframe.region-map')).toHaveAttribute('src', /lat=47\.6&lng=10\.3(&|$)/);

  // Client-side navigation to another region page matched by the SAME
  // [slug].vue component — no full page reload happens here.
  await page.locator('a[href="/trails/berlin"]').click();
  await page.waitForLoadState('networkidle');

  await expect(page.locator('h1')).toHaveText('Trails in Berlin');
  await expect(page.locator('iframe.region-map')).toHaveAttribute('src', /lat=52\.5&lng=13\.4(&|$)/);

  assertNoLeaks();
});

// ── Via search — flies the map, doesn't navigate ─────────────────────────────────
// Selecting a trail/bikepark search result now flies the still-live map to
// it and zooms in, exactly like ?trail= above — it stays on /map. Only
// clicking the spot's own marker (see "marker click" below) opens its
// detail page.

test('selecting a search result flies the map to it without navigating', async ({ page }) => {
  const tileUrls = trackTileRequests(page);

  await page.locator('[data-testid="search-input"]').fill('Flow');
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

  // Click the result item (not just the text — click the whole row)
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await page.waitForTimeout(1500); // let the flyTo animation finish and its tiles fire

  await expect(page).toHaveURL(/\/map$/);
  // Selecting a result clears the search UI (SearchBar.vue's select() calls clear())
  await expect(page.locator('[data-testid="search-results"]')).toBeHidden();
  const flownTiles = tileUrls.map(decodeTileUrl).filter((t): t is NonNullable<typeof t> => t?.z === 14);
  expect(flownTiles.length).toBeGreaterThan(0);
  expect(flownTiles.some(t => Math.abs(t.lat - 47.71) < 0.05 && Math.abs(t.lng - 11.76) < 0.05)).toBe(true);
});

test('selecting a bikepark in search results flies the map to it without navigating', async ({ page }) => {
  const tileUrls = trackTileRequests(page);

  await page.locator('[data-testid="search-input"]').fill('Bikepark');
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

  await page.locator('.search-result-item').filter({ hasText: 'Bikepark Lenggries' }).click();
  await page.waitForTimeout(1500);

  await expect(page).toHaveURL(/\/map$/);
  const flownTiles = tileUrls.map(decodeTileUrl).filter((t): t is NonNullable<typeof t> => t?.z === 14);
  expect(flownTiles.length).toBeGreaterThan(0);
  expect(flownTiles.some(t => Math.abs(t.lat - 47.68) < 0.05 && Math.abs(t.lng - 11.56) < 0.05)).toBe(true);
});

test('selecting a second search result flies to it too, without ever leaving /map', async ({ page }) => {
  const tileUrls = trackTileRequests(page);

  await page.locator('[data-testid="search-input"]').fill('Flow');
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await page.waitForTimeout(1500);
  await expect(page).toHaveURL(/\/map$/);

  tileUrls.length = 0; // isolate the second selection's own tile requests
  await page.locator('[data-testid="search-input"]').fill('Bikepark');
  await page.locator('.search-result-item').filter({ hasText: 'Bikepark Lenggries' }).click();
  await page.waitForTimeout(1500);

  await expect(page).toHaveURL(/\/map$/);
  const flownTiles = tileUrls.map(decodeTileUrl).filter((t): t is NonNullable<typeof t> => t?.z === 14);
  expect(flownTiles.length).toBeGreaterThan(0);
  expect(flownTiles.some(t => Math.abs(t.lat - 47.68) < 0.05 && Math.abs(t.lng - 11.56) < 0.05)).toBe(true);
});

// ── Marker click — the only remaining "open this spot" navigation ───────────────
// Unlike ?trail= and search, clicking a spot's own marker still does a real
// router.push to its detail page (useTrailMap.ts's renderMarkers()). Going
// back from there lands on /map?trail=id, not a bare /map — navigateToSpot()
// rewrites the current history entry (via router.replace, awaited so it
// isn't clobbered by the immediately-following router.push — see its
// comment in useTrailMap.ts) before pushing, so browser back re-enters /map
// with the spot's own ?trail= breadcrumb and flies back to it.

baseTest('clicking a trail marker navigates to its own page, and going back returns to /map?trail=id and flies there', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  // Isolate a single marker so the click target is unambiguous.
  await page.route('**/rest/v1/trails**',    (route) => route.fulfill({ json: [MOCK_TRAILS[0]] }));
  await page.route('**/rest/v1/parks**',      (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/dirt_parks**', (route) => route.fulfill({ json: [] }));

  await page.goto('/map');
  await page.waitForLoadState('networkidle');

  await page.locator('.map-pin').click();

  await expect(page).toHaveURL(/\/trails\/t1$/);
  await expect(page.locator('h1')).toContainText('Flowtrail Tegernsee');

  const tileUrls = trackTileRequests(page);
  await page.goBack();

  await expect(page).toHaveURL(/\/map\?trail=t1$/);
  await expect(page.locator('[data-testid="map-container"]')).toBeVisible();
  await page.waitForTimeout(1500); // let the flyTo animation finish and its tiles fire
  const flownTiles = tileUrls.map(decodeTileUrl).filter((t): t is NonNullable<typeof t> => t?.z === 14);
  expect(flownTiles.length).toBeGreaterThan(0);
  // t1's fixture coordinates (tests/fixtures.ts)
  expect(flownTiles.some(t => Math.abs(t.lat - 47.71) < 0.05 && Math.abs(t.lng - 11.76) < 0.05)).toBe(true);
  assertNoLeaks();
});
