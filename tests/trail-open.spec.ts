import { test as baseTest } from '@playwright/test';
import { test, expect, setupAllMocks } from './fixtures';

// Helper: assert the spot panel is open and showing the right trail
async function expectPanelOpen(page: import('@playwright/test').Page, trailName: string) {
  await expect(page.locator('.spot-panel')).toHaveClass(/open/, { timeout: 8000 });
  await expect(page.locator('.spot-panel-title')).toContainText(trailName);
}

// ── Via URL ────────────────────────────────────────────────────────────────────
// These use baseTest (no pre-navigation) so the URL is the first and only load,
// letting getInitialLocation() see /trails/[id] and call map.openTrail() on boot.

baseTest('navigating to /trails/[id] opens spot panel for that trail', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');

  await expectPanelOpen(page, 'Flowtrail Tegernsee');
  assertNoLeaks();
});

baseTest('URL trail open works for a bikepark too', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/b1');
  await page.waitForLoadState('networkidle');

  await expectPanelOpen(page, 'Bikepark Lenggries');
  assertNoLeaks();
});

// ── Via news section ───────────────────────────────────────────────────────────
// Mock news items after sort (ascending created_at, at(-i) for i=1..N):
//   show-last-1 → t3 Schotterpiste
//   show-last-2 → t2 Waldpfad Ingolstadt
//   show-last-3 → t1 Flowtrail Tegernsee

test('clicking a news item link opens the spot panel for that trail', async ({ page }) => {
  // Wait for news to be rendered
  await expect(page.locator('#show-last-2')).toBeVisible();

  await page.locator('#show-last-2 a').first().click();

  await expectPanelOpen(page, 'Waldpfad Ingolstadt');
});

test('different news items open different trails', async ({ page }) => {
  await expect(page.locator('#show-last-1')).toBeVisible();
  await page.locator('#show-last-1 a').first().click();
  await expectPanelOpen(page, 'Schotterpiste');

  // Close and open a different one
  await page.locator('.spot-panel-close').click();
  await expect(page.locator('.spot-panel')).not.toHaveClass(/open/);

  await expect(page.locator('#show-last-3')).toBeVisible();
  await page.locator('#show-last-3 a').first().click();
  await expectPanelOpen(page, 'Flowtrail Tegernsee');
});

// ── Via search ─────────────────────────────────────────────────────────────────

test('clicking a search result opens the spot panel for that trail', async ({ page }) => {
  await page.locator('#search').fill('Flow');
  await expect(page.locator('#search-results')).toBeVisible();

  // Click the result item (not just the text — click the whole row)
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();

  await expectPanelOpen(page, 'Flowtrail Tegernsee');
});

test('clicking a bikepark in search results opens the spot panel', async ({ page }) => {
  await page.locator('#search').fill('Bikepark');
  await expect(page.locator('#search-results')).toBeVisible();

  await page.locator('.search-result-item').filter({ hasText: 'Bikepark Lenggries' }).click();

  await expectPanelOpen(page, 'Bikepark Lenggries');
});

// ── Panel lifecycle ─────────────────────────────────────────────────────────────

test('spot panel close button closes the panel', async ({ page }) => {
  // Open via search
  await page.locator('#search').fill('Flow');
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await expect(page.locator('.spot-panel')).toHaveClass(/open/);

  await page.locator('.spot-panel-close').click();

  await expect(page.locator('.spot-panel')).not.toHaveClass(/open/);
});

test('opening a second trail replaces the first one in the panel', async ({ page }) => {
  await page.locator('#search').fill('Flow');
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await expectPanelOpen(page, 'Flowtrail Tegernsee');

  // After clicking a result the search input is cleared automatically — just fill again
  await page.locator('#search').fill('Bikepark');
  await page.locator('.search-result-item').filter({ hasText: 'Bikepark Lenggries' }).click();

  await expectPanelOpen(page, 'Bikepark Lenggries');
});
