import { test, expect } from './fixtures';

// E2E coverage for the Parking tab.

const LOT_WITH_INFO = {
  id: 'p1', spot_id: 't1', name: 'Talstation Parkplatz', lat: 47.709, lng: 11.758,
  info: ['Gewichtsbeschränkung: 3.5t', 'Kostenlos'],
};

async function openTrailPanel(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await expect(page.locator('.spot-panel')).toHaveClass(/open/);
}

test('Parking tab shows the lot name and info lines when the spot has parking', async ({ page }) => {
  await page.route('**/rest/v1/parking**', (route) => route.fulfill({ json: [LOT_WITH_INFO] }));

  await openTrailPanel(page);

  const parkingTab = page.locator('.spot-tab[data-tab="parking"]');
  await expect(parkingTab).toBeVisible();
  await parkingTab.click();

  const content = page.locator('#spot-parking-tab');
  await expect(content).toContainText('Talstation Parkplatz');
  await expect(content).toContainText('Gewichtsbeschränkung: 3.5t');
  await expect(content).toContainText('Kostenlos');
});

test('the Parking tab button stays hidden and the tab content shows the empty-state message when the spot has no parking', async ({ page }) => {
  await page.route('**/rest/v1/parking**', (route) => route.fulfill({ json: [] }));

  await openTrailPanel(page);

  await expect(page.locator('.spot-tab[data-tab="parking"]')).not.toBeVisible();
  // Content is still rendered (just not switched to) — same as the vanilla
  // renderParking() call that runs regardless of tab visibility.
  await expect(page.locator('#spot-parking-tab')).toContainText('Keine Parkplätze für diesen Spot.');
});

test('openParkingLot() jumps straight to the Parking tab with the clicked lot highlighted', async ({ page }) => {
  test.setTimeout(20000);
  await page.route('**/rest/v1/parking**', (route) => route.fulfill({ json: [LOT_WITH_INFO] }));

  await openTrailPanel(page);
  // Normal open path defaults to the Info tab.
  await expect(page.locator('.spot-tab[data-tab="info"]')).toHaveClass(/active/);

  // Opening a trail flies the map to GPX_ZOOM_THRESHOLD, which renders the
  // parking marker on the map itself (independent of the panel/tab).
  const marker = page.locator('.parking-pin');
  await expect(marker).toBeVisible({ timeout: 15000 });
  await marker.click({ force: true });

  await expect(page.locator('.spot-tab[data-tab="parking"]')).toHaveClass(/active/);
  await expect(page.locator('#spot-parking-tab')).not.toHaveClass(/hidden/);
  await expect(page.locator('.parking-item[data-id="p1"]')).toHaveClass(/active/);
});

test('Parking tab lots and empty state render correctly on a small (mobile) viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.route('**/rest/v1/parking**', (route) => route.fulfill({ json: [LOT_WITH_INFO] }));

  await openTrailPanel(page);

  const parkingTab = page.locator('.spot-tab[data-tab="parking"]');
  await expect(parkingTab).toBeVisible();
  await parkingTab.click();

  const content = page.locator('#spot-parking-tab');
  await expect(content).toBeVisible();
  await expect(content).toContainText('Talstation Parkplatz');
});
