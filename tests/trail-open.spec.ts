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
  await expect(page.locator('a[href="/map?trail=t1"]')).toBeVisible();
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
