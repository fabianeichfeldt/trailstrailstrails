import { test as baseTest, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { setupAllMocks, signInOnProfilePage, navigateClientSide } from './fixtures';

// Making the Boden-Radar discoverable: the one-time callout on /map, the ?radar=1
// deep link, and the cross-link on the spot page's Trail-Zustand card.

const SNAPSHOT = {
  computedAt: new Date().toISOString(),
  spots: [{ t: 'trail', id: 't1', lat: 47.71, lon: 11.76, lvl: 'prime', lo: 1.5, hi: 2.5 }],
};

const supporterRows = [{ plan_id: 'supporter', level: 1, discount_percent: 0, early_adopter_free_until: null }];

/** setupAllMocks marks the callout as seen; undo that for the first page load of this test only. */
async function asFirstTimeVisitor(page: Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('intro-opt-in')) return;
    sessionStorage.setItem('intro-opt-in', '1');
    localStorage.removeItem('soil-radar-intro-seen');
  });
}

async function signInAsSupporter(page: Page) {
  await page.route('**/rest/v1/rpc/get_my_entitlement', (route) => route.fulfill({ json: supporterRows }));
  await page.route('**/functions/v1/soil-map', (route) => route.fulfill({ json: SNAPSHOT }));
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await signInOnProfilePage(page);
}

baseTest('a first-time visitor gets the callout, and "Radar starten" plays the sample', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await asFirstTimeVisitor(page);
  await page.goto('/map');

  const intro = page.locator('[data-testid="soil-intro"]');
  await expect(intro).toBeVisible({ timeout: 10_000 });
  await expect(intro).toContainText("Wo fährt's sich heute am besten?");
  await expect(page.locator('[data-testid="soil-radar-button"]')).toHaveClass(/is-new/);

  await page.locator('[data-testid="soil-intro-try"]').click();
  await expect(intro).toHaveCount(0);
  await expect(page.locator('[data-testid="soil-sample-pill"]')).toBeVisible();
  await expect(page.locator('[data-testid="soil-radar-button"]')).not.toHaveClass(/is-new/);

  assertNoLeaks();
});

baseTest('a dismissed callout stays away on the next visit', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await asFirstTimeVisitor(page);
  await page.goto('/map');

  await page.locator('[data-testid="soil-intro-close"]').click({ timeout: 10_000 });
  await expect(page.locator('[data-testid="soil-intro"]')).toHaveCount(0);

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5_000); // longer than the callout's dwell
  await expect(page.locator('[data-testid="soil-intro"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="soil-radar-button"]')).not.toHaveClass(/is-new/);

  assertNoLeaks();
});

baseTest('/map?radar=1 opens the live radar for a Supporter, without the callout', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await asFirstTimeVisitor(page);
  await signInAsSupporter(page);
  await navigateClientSide(page, '/map?radar=1');

  await expect(page.locator('[data-testid="soil-panel"]')).toBeVisible();
  await expect(page.locator('[data-testid="soil-sample-pill"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="soil-intro"]')).toHaveCount(0);

  assertNoLeaks();
});

baseTest('the Trail-Zustand card links a Supporter to the radar', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await signInAsSupporter(page);
  await navigateClientSide(page, '/trails/t1');

  const link = page.locator('[data-testid="soil-radar-link"]');
  await expect(link).toBeVisible();
  await expect(link).toContainText('Alle Spots vergleichen');
  await link.click();

  await expect(page).toHaveURL(/\/map\?radar=1$/);
  await expect(page.locator('[data-testid="soil-panel"]')).toBeVisible();

  assertNoLeaks();
});
