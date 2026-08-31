import { test as baseTest } from '@playwright/test';
import { expect, setupAllMocks } from './fixtures';

// E2E coverage for the Parkplätze section on the routed spot-detail page
// (app/pages/trails/[slug].vue). Rewritten for the spot-detail-real-pages
// rework: the section is always present (gated on whether the spot has any
// lots) instead of being a switched-to tab, and clicking a parking marker
// on the live map now navigates to the spot's page instead of jumping to a
// tab with the clicked lot highlighted — deep-linking to a specific lot
// selection was dropped as YAGNI (Decision 6 of the spec).

const LOT_WITH_INFO = {
  id: 'p1', spot_id: 't1', name: 'Talstation Parkplatz', lat: 47.709, lng: 11.758,
  info: ['Gewichtsbeschränkung: 3.5t', 'Kostenlos'],
};

baseTest('the Parkplätze section shows the lot name and info lines when the spot has parking', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.route('**/rest/v1/parking**', (route) => route.fulfill({ json: [LOT_WITH_INFO] }));

  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');

  const content = page.locator('#parkplaetze');
  await expect(content).toBeVisible();
  await expect(content).toContainText('Talstation Parkplatz');
  await expect(content).toContainText('Gewichtsbeschränkung: 3.5t');
  await expect(content).toContainText('Kostenlos');
  await expect(page.locator('a[href="#parkplaetze"]')).toBeVisible();

  assertNoLeaks();
});

baseTest('clicking a parking lot flies the embedded map to it and marks the row active', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.route('**/rest/v1/parking**', (route) => route.fulfill({ json: [LOT_WITH_INFO] }));

  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');

  const iframeEl = page.locator('iframe.trail-map');
  const srcBefore = await iframeEl.getAttribute('src');

  // Listen for the raw postMessage inside the iframe's own window — same
  // contract used for Touren/Trails rows (app/pages/embed/[token].vue).
  const frame = await (await iframeEl.elementHandle())!.contentFrame();
  const messagePromise = frame!.evaluate(() => new Promise((resolve) => {
    window.addEventListener('message', (e) => resolve(e.data), { once: true });
  }));

  const row = page.locator('#parkplaetze .spot-item[data-id="p1"]');
  await row.click();

  await expect(messagePromise).resolves.toEqual({ type: 'trailradar:flyTo', lat: 47.709, lng: 11.758, zoom: 14 });
  await expect(row).toHaveClass(/active/);

  // The iframe itself never reloaded — src is unchanged.
  await expect(iframeEl).toHaveAttribute('src', srcBefore!);
  assertNoLeaks();
});

baseTest('the Parkplätze section and its jump-link stay absent when the spot has no parking', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.route('**/rest/v1/parking**', (route) => route.fulfill({ json: [] }));

  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('#parkplaetze')).toHaveCount(0);
  await expect(page.locator('a[href="#parkplaetze"]')).toHaveCount(0);

  assertNoLeaks();
});

baseTest('clicking a parking marker on the map navigates to the spot\'s Parkplätze section', async ({ page }) => {
  baseTest.setTimeout(20000);
  const assertNoLeaks = await setupAllMocks(page);
  await page.route('**/rest/v1/parking**', (route) => route.fulfill({ json: [LOT_WITH_INFO] }));

  await page.goto('/map');
  await page.waitForLoadState('networkidle');

  // Parking markers only render in GPX view (zoom >= GPX_ZOOM_THRESHOLD,
  // currently 11; the mocked geolocation puts the initial view at zoom 9).
  // Marker clicks no longer fly the map there automatically (that flyTo
  // was removed along with spotPanelStore.openSpot() — see useTrailMap.ts)
  // since navigating away makes the animation pointless, so zoom in by hand
  // via the map's own zoom-in control, which recenters around the map's
  // current center (unlike scroll-wheel zoom, which zooms around the
  // cursor and can push a marker far off-screen after a few steps).
  await page.locator('.leaflet-control-zoom-in').click();
  await page.waitForTimeout(400); // let the zoom animation's 'zoomend' fire
  await page.locator('.leaflet-control-zoom-in').click();
  await page.waitForTimeout(400);
  // Let the GPX-view re-render (parking markers are torn down and
  // recreated on every pan/zoom in renderGpxView()) fully settle before
  // interacting — clicking mid-re-render risks hitting a marker that's
  // about to be removed.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const marker = page.locator('.parking-pin');
  await expect(marker).toBeVisible({ timeout: 15000 });
  await marker.click();

  await expect(page).toHaveURL(/\/trails\/t1#parkplaetze$/);
  await expect(page.locator('#parkplaetze')).toContainText('Talstation Parkplatz');

  assertNoLeaks();
});

baseTest('Parkplätze section renders correctly on a small (mobile) viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  const assertNoLeaks = await setupAllMocks(page);
  await page.route('**/rest/v1/parking**', (route) => route.fulfill({ json: [LOT_WITH_INFO] }));

  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');

  const content = page.locator('#parkplaetze');
  await expect(content).toBeVisible();
  await expect(content).toContainText('Talstation Parkplatz');

  assertNoLeaks();
});
