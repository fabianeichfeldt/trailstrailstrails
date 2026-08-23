import { test as baseTest } from '@playwright/test';
import { test, expect, setupAllMocks } from './fixtures';

// Helper: assert the spot panel is open and showing the right trail
async function expectPanelOpen(page: import('@playwright/test').Page, trailName: string) {
  await expect(page.locator('.spot-panel')).toHaveClass(/open/, { timeout: 8000 });
  await expect(page.locator('.spot-panel-title')).toContainText(trailName);
}

// ── Via ?trail= query param ────────────────────────────────────────────────────
// The news cards on the landing page link to /map?trail=ID.
// The map page reads this query param on mount and opens the spot panel.

baseTest('/map?trail= opens the spot panel on load', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/map?trail=t1');
  await page.waitForLoadState('networkidle');

  await expectPanelOpen(page, 'Flowtrail Tegernsee');
  assertNoLeaks();
});

baseTest('/map?trail= works for a bikepark', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/map?trail=b1');
  await page.waitForLoadState('networkidle');

  await expectPanelOpen(page, 'Bikepark Lenggries');
  assertNoLeaks();
});

// ── Trail detail page ──────────────────────────────────────────────────────────
// /trails/[id] is a static SEO page — it shows trail details and links to the map.

baseTest('/trails/[id] shows the trail name and map link', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('h1')).toContainText('Flowtrail Tegernsee');
  await expect(page.locator('a[href="/map?trail=t1"]').first()).toBeVisible();
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

// ── Via search ─────────────────────────────────────────────────────────────────

test('clicking a search result opens the spot panel for that trail', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

  // Click the result item (not just the text — click the whole row)
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();

  await expectPanelOpen(page, 'Flowtrail Tegernsee');
});

test('clicking a bikepark in search results opens the spot panel', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('Bikepark');
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

  await page.locator('.search-result-item').filter({ hasText: 'Bikepark Lenggries' }).click();

  await expectPanelOpen(page, 'Bikepark Lenggries');
});

// ── Panel lifecycle ─────────────────────────────────────────────────────────────

test('spot panel close button closes the panel', async ({ page }) => {
  // Open via search
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await expect(page.locator('.spot-panel')).toHaveClass(/open/);

  await page.locator('.spot-panel-close').click();

  await expect(page.locator('.spot-panel')).not.toHaveClass(/open/);
});

test('opening a second trail replaces the first one in the panel', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await expectPanelOpen(page, 'Flowtrail Tegernsee');

  // After clicking a result the search input is cleared automatically — just fill again
  await page.locator('[data-testid="search-input"]').fill('Bikepark');
  await page.locator('.search-result-item').filter({ hasText: 'Bikepark Lenggries' }).click();

  await expectPanelOpen(page, 'Bikepark Lenggries');
});
