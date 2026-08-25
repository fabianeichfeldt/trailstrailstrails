import { test as baseTest } from '@playwright/test';
import { test, expect, setupAllMocks } from './fixtures';

// ── Via ?trail= query param ────────────────────────────────────────────────────
// The news cards on the landing page link to /map?trail=ID. The map page
// reads this query param on mount and, since the spot-detail-real-pages
// rework (marker clicks and other "open this spot" entry points are now
// real navigations — see useTrailMap.ts's openTrailFn), navigates straight
// to the spot's own page instead of opening a panel on top of the map.

baseTest('/map?trail= navigates to the spot\'s own page', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/map?trail=t1');

  await expect(page).toHaveURL(/\/trails\/t1$/);
  await expect(page.locator('h1')).toContainText('Flowtrail Tegernsee');
  assertNoLeaks();
});

baseTest('/map?trail= works for a bikepark', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/map?trail=b1');

  await expect(page).toHaveURL(/\/trails\/b1$/);
  await expect(page.locator('h1')).toContainText('Bikepark Lenggries');
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

// ── Via search — real navigation, not a panel ────────────────────────────────────
// Rewritten for the spot-detail-real-pages rework: "open this spot" from
// /map (marker click, search result, ?trail= query param — all wired
// through the same openTrailFn/marker click handlers in useTrailMap.ts) is
// now a real router.push to the spot's own page, not a panel opened on top
// of the still-live map. This exercises the identical navigation mechanism
// a marker click uses; see tests/trails-detail-page.spec.ts and
// tests/spot-panel-*.spec.ts for the resulting page's own section coverage.

test('clicking a search result navigates to that trail\'s own page', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

  // Click the result item (not just the text — click the whole row)
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();

  await expect(page).toHaveURL(/\/trails\/t1$/);
  await expect(page.locator('h1')).toContainText('Flowtrail Tegernsee');
});

test('clicking a bikepark in search results navigates to its own page', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('Bikepark');
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

  await page.locator('.search-result-item').filter({ hasText: 'Bikepark Lenggries' }).click();

  await expect(page).toHaveURL(/\/trails\/b1$/);
  await expect(page.locator('h1')).toContainText('Bikepark Lenggries');
});

// ── Back navigation ───────────────────────────────────────────────────────────
// New coverage per the spec's testing implications: marker click (here,
// search — see the comment above) → real navigation → back returns to /map.

test('going back from a spot\'s page returns to /map', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await expect(page).toHaveURL(/\/trails\/t1$/);

  await page.goBack();

  await expect(page).toHaveURL(/\/map$/);
  await expect(page.locator('[data-testid="map-container"]')).toBeVisible();
});

test('navigating to a second trail via search lands on that trail\'s own page, not the first one', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await expect(page).toHaveURL(/\/trails\/t1$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/map$/);

  // After landing back on the result the search input is cleared automatically — fill again
  await page.locator('[data-testid="search-input"]').fill('Bikepark');
  await page.locator('.search-result-item').filter({ hasText: 'Bikepark Lenggries' }).click();

  await expect(page).toHaveURL(/\/trails\/b1$/);
  await expect(page.locator('h1')).toContainText('Bikepark Lenggries');
});
