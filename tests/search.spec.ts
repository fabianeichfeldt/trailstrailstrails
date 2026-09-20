import { test as baseTest } from '@playwright/test';
import { test, expect, setupAllMocks } from './fixtures';

test('typing a trail name shows matching results', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('Flow');

  const results = page.locator('[data-testid="search-results"]');
  await expect(results).toBeVisible();
  await expect(results).toContainText('Flowtrail Tegernsee');
});

test('typing a bikepark name shows it in results', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('Bikepark');
  await expect(page.locator('[data-testid="search-results"]')).toContainText('Bikepark Lenggries');
});

test('results section shows category separator for trails', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('Flow');

  // Wait for results, then check the separator — Nominatim is mocked empty in
  // fixtures so only one separator ("Trails & Parks") can ever appear here.
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  await expect(page.locator('.search-result-separator').first()).toContainText('Trails & Parks');
});

test('unknown query shows empty-state message', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('xyzunknown123');
  await expect(page.locator('[data-testid="search-results"]')).toContainText('Keine Ergebnisse');
});

test('clear button hides search results', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

  await page.locator('[data-testid="search-clear"]').click();

  await expect(page.locator('[data-testid="search-results"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="search-input"]')).toHaveValue('');
});

test('short query (< 2 chars) shows no results', async ({ page }) => {
  await page.locator('[data-testid="search-input"]').fill('F');
  await expect(page.locator('[data-testid="search-results"]')).not.toBeAttached();
});

// ── Landing-page searchbar ─────────────────────────────────────────────────────
// The teaser on `/` hosts the same SearchBar component in its "teaser" variant
// (app/components/MapTeaser.vue). It has no live map to drive, so picking a
// result navigates to the map instead — the one part of the flow vitest cannot
// cover, since it spans two routes and a real router.
//
// Note: `/map?trail=` flies the live map to the spot and zooms in; it does not
// open a panel (see tests/trail-open.spec.ts and app/pages/map.vue), so that is
// what this asserts.

baseTest('picking a spot in the landing-page searchbar opens it on the map', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  const tileUrls: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('tile.openstreetmap.org')) tileUrls.push(req.url());
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // The teaser searchbar has to be usable at all — it sits outside the teaser's
  // link and above the "Zur Karte" CTA overlay, or this click would either be
  // swallowed by the overlay or navigate straight to /map.
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();

  await expect(page).toHaveURL(/\/map\?trail=t1$/);
  await expect(page.locator('[data-testid="map-container"]')).toBeVisible();
  await page.waitForTimeout(1500); // let the flyTo animation finish and its tiles fire

  // t1's fixture coordinates (tests/fixtures.ts) — proves the map really flew there.
  const flown = tileUrls
    .map((url) => {
      const m = url.match(/\/(\d+)\/(\d+)\/(\d+)\.png/);
      if (!m) return null;
      const z = Number(m[1]);
      const n = 2 ** z;
      return {
        z,
        lng: Number(m[2]) / n * 360 - 180,
        lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * Number(m[3]) / n))) * 180 / Math.PI,
      };
    })
    .filter((t): t is { z: number; lat: number; lng: number } => t?.z === 14);
  expect(flown.some(t => Math.abs(t.lat - 47.71) < 0.05 && Math.abs(t.lng - 11.76) < 0.05)).toBe(true);
  assertNoLeaks();
});
