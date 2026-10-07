import { test as baseTest, expect } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { setupAllMocks, signInOnProfilePage, navigateClientSide } from './fixtures';

// Boden-Radar: the premium soil layer on /map. The soil-map edge function and the
// entitlement RPC are mocked at the network boundary; everything else is the real
// client (store, layer, markers, panel). Auth lives in memory after signing in on
// the profile page, so Supporter cases reach /map by client-side navigation.

// Positions match the fixture spots (t1, t2, b1, d1) so verdicts attach to real pins.
const SNAPSHOT = {
  computedAt: new Date().toISOString(),
  spots: [
    { t: 'trail', id: 't1', lat: 47.71, lon: 11.76, lvl: 'prime', lo: 1.5, hi: 2.5 },
    { t: 'trail', id: 't2', lat: 48.76, lon: 11.42, lvl: 'wet', lo: 3.5, hi: 4 },
    { t: 'bikepark', id: 'b1', lat: 47.68, lon: 11.56, lvl: 'dry', lo: 0.8, hi: 1.5 },
    { t: 'dirtpark', id: 'd1', lat: 48.14, lon: 11.57, lvl: 'dusty', lo: 0, hi: 0.6 },
  ],
};

function entitlementRows(level: number) {
  return level === 0 ? [] : [{ plan_id: 'supporter', level, discount_percent: 0, early_adopter_free_until: null }];
}

function trackSoilRequests(page: Page): Request[] {
  const calls: Request[] = [];
  page.on('request', (r) => { if (r.url().includes('/functions/v1/soil-map')) calls.push(r); });
  return calls;
}

async function mockSoilMap(page: Page) {
  await page.route('**/functions/v1/soil-map', (route) => route.fulfill({ json: SNAPSHOT }));
}

async function openMapAsSupporter(page: Page) {
  await page.route('**/rest/v1/rpc/get_my_entitlement', (route) => route.fulfill({ json: entitlementRows(1) }));
  await mockSoilMap(page);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await signInOnProfilePage(page);
  await navigateClientSide(page, '/map');
  await expect(page.locator('[data-testid="soil-radar-button"]')).toBeVisible();
}

/** Unclustered pins, so every spot shows its own soil badge. */
async function disableClustering(page: Page) {
  await page.locator('[data-testid="burger-btn"]').click();
  await page.locator('label:has([data-testid="cluster-toggle"])').click();
  if (await page.locator('[data-testid="drawer"].open').count()) await page.locator('[data-testid="drawer-close"]').click();
  await expect(page.locator('[data-testid="drawer"].open')).toHaveCount(0);
}

baseTest('a Supporter turns the radar on: soil badges on the pins, panel and counter', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  const soilCalls = trackSoilRequests(page);
  await openMapAsSupporter(page);
  await disableClustering(page);

  await page.locator('[data-testid="soil-radar-button"]').click();

  await expect(page.locator('[data-testid="soil-panel"]')).toBeVisible();
  await expect(page.locator('.leaflet-marker-pane .soil-badge')).toHaveCount(4);
  await expect(page.locator('.leaflet-marker-pane .soil-badge-prime')).toHaveCount(1);
  await expect(page.locator('[data-testid="map-container"]')).toHaveClass(/soil-radar-on/);
  await expect(page.locator('[data-testid="map-container"]')).toHaveClass(/leaflet-container/); // the radar class must not wipe Leaflet's
  await expect(page.locator('[data-testid="soil-counter"]')).toHaveText(/3 von 3 Spots/);
  await expect(page.locator('.soil-radar-canvas')).toBeAttached();

  // Sent the user's token, nothing else.
  expect(soilCalls).toHaveLength(1);
  expect(soilCalls[0]!.headers()['authorization']).toContain('Bearer');

  // Turning it off removes the badges again.
  await page.locator('[data-testid="soil-radar-button"]').click();
  await expect(page.locator('[data-testid="soil-panel"]')).toHaveCount(0);
  await expect(page.locator('.leaflet-marker-pane .soil-badge')).toHaveCount(0);
  await expect(page.locator('[data-testid="map-container"]')).not.toHaveClass(/soil-radar-on/);

  assertNoLeaks();
});

baseTest('dragging the range slider ghosts the pins outside it, and the counter follows', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await openMapAsSupporter(page);
  await disableClustering(page);
  await page.locator('[data-testid="soil-radar-button"]').click();
  await expect(page.locator('.leaflet-marker-pane .soil-badge')).toHaveCount(4);
  await expect(page.locator('.leaflet-marker-pane .soil-ghost')).toHaveCount(0);

  // Pointer drag: lower handle from "staubig" (0) to "Hero" (2) ghosts dusty + dry.
  const handle = page.locator('[data-testid="soil-panel"] [data-which="lo"]');
  const ramp = page.locator('[data-testid="soil-ramp"]');
  await handle.hover(); // waits for the panel slide-up to settle
  const rb = (await ramp.boundingBox())!;
  const hb = (await handle.boundingBox())!;
  await page.mouse.down();
  await page.mouse.move(rb.x + rb.width * 0.5, hb.y + hb.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect(page.locator('.leaflet-marker-pane .soil-ghost')).toHaveCount(2);
  await expect(page.locator('[data-testid="soil-counter"]')).toHaveText("1 von 3 Spots");
  await expect(handle).toHaveAttribute('aria-valuenow', '2');

  // Keyboard: the upper handle one step down (Matsch -> feucht) ghosts the wet pin too.
  await page.locator('[data-testid="soil-panel"] [data-which="hi"]').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.leaflet-marker-pane .soil-ghost')).toHaveCount(3);

  // Back to the full range: nothing ghosted.
  await page.locator('[data-testid="soil-panel"] [data-which="hi"]').press('End');
  await page.locator('[data-testid="soil-panel"] [data-which="lo"]').focus();
  await page.keyboard.press('Home');
  await expect(page.locator('.leaflet-marker-pane .soil-ghost')).toHaveCount(0);

  assertNoLeaks();
});

baseTest('clusters turn into soil donuts while the radar is on', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await openMapAsSupporter(page);

  await page.locator('[data-testid="soil-radar-button"]').click();
  await expect(page.locator('[data-testid="soil-panel"]')).toBeVisible();
  // Fixture spots are close enough to cluster at the default zoom: either donuts or single badges.
  await expect(page.locator('.leaflet-marker-pane .soil-donut, .leaflet-marker-pane .soil-badge').first()).toBeVisible();
  await expect(page.locator('.leaflet-marker-pane .marker-cluster')).toHaveCount(0);

  await page.locator('[data-testid="soil-radar-button"]').click();
  await expect(page.locator('.leaflet-marker-pane .soil-donut')).toHaveCount(0);

  assertNoLeaks();
});

baseTest('a logged-out visitor gets the sample view and the sheet, and nothing is requested', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  const soilCalls = trackSoilRequests(page);
  await mockSoilMap(page);
  await page.goto('/map');
  await page.waitForLoadState('networkidle');

  await page.locator('[data-testid="soil-radar-button"]').click();

  await expect(page.locator('[data-testid="soil-sample-pill"]')).toHaveText('Beispielansicht');
  await expect(page.locator('[data-testid="soil-locked-sheet"]')).toBeVisible();
  expect(soilCalls).toEqual([]);

  // Closing the sheet ends the sample.
  await page.locator('[data-testid="soil-locked-close"]').click();
  await expect(page.locator('[data-testid="soil-locked-sheet"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="soil-panel"]')).toHaveCount(0);
  expect(soilCalls).toEqual([]);

  assertNoLeaks();
});

baseTest('the sheet\'s register button leaves the auth modal on top, not underneath', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/map');
  await page.waitForLoadState('networkidle');

  await page.locator('[data-testid="soil-radar-button"]').click();
  await page.locator('[data-testid="soil-locked-cta"]').click();

  await expect(page.locator('.auth-card')).toBeVisible();
  await expect(page.locator('[data-testid="soil-locked-sheet"]')).toHaveCount(0);
  // Clickable, i.e. really on top: the topmost element at its centre belongs to the modal.
  const onTop = await page.locator('.auth-card').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
  expect(onTop).toBe(true);

  assertNoLeaks();
});

baseTest('a signed-in free account sees the sample and a link to the plans, and no soil-map request', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  const soilCalls = trackSoilRequests(page);
  await page.route('**/rest/v1/rpc/get_my_entitlement', (route) => route.fulfill({ json: entitlementRows(0) }));
  await mockSoilMap(page);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await signInOnProfilePage(page);
  await navigateClientSide(page, '/map');

  await page.locator('[data-testid="soil-radar-button"]').click();
  await expect(page.locator('[data-testid="soil-sample-pill"]')).toBeVisible();
  await expect(page.locator('[data-testid="soil-locked-link"]')).toHaveAttribute('href', '/plans');
  expect(soilCalls).toEqual([]);

  assertNoLeaks();
});
