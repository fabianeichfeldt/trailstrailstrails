import { test as baseTest } from '@playwright/test';
import { expect, setupAllMocks } from './fixtures';

// E2E coverage for the Touren/Trails sections and the elevation panel on
// the routed spot-detail page (app/pages/trails/[slug].vue). Rewritten for
// the spot-detail-real-pages rework: Touren/Trails are always-visible
// sections (not switched-to tabs — see SpotDetailNav.vue), and the
// elevation view is a separate component mounted inline right under
// whichever section has an active selection (v-if on
// selectedItemKind), not a CSS-toggled overlay inside a fixed panel shell.
// Sheet-mechanics coverage this file used to carry (drag-to-snap, tap-to-
// cycle peek/half/full, the mobile drill-in height check) is dropped
// entirely — that behavior belonged to SpotPanel.vue's bottom-sheet, which
// has no equivalent on a long-scroll page (Decision 7 of the spec:
// 2026-08-20's Phase 3/4 sheet mechanics are superseded, not carried over).

const GPX_TRAIL_OPEN = {
  id: 'gt1', spot_id: 't1', name: 'Talabfahrt', difficulty: 'blue', direction: 'one-way-down',
  distance_km: 3.2, elevation_gain: 50, elevation_loss: 420,
  gpx_points: [
    [47.710, 11.760, 900],
    [47.712, 11.762, 850],
    [47.714, 11.764, 780],
    [47.716, 11.766, 700],
  ],
  gpx_url: 'https://example.com/gt1.gpx',
};

const GPX_TRAIL_CLOSED = {
  id: 'gt2', spot_id: 't1', name: 'Gesperrter Trail', difficulty: 'red', direction: 'both',
  distance_km: 2.0, elevation_gain: 30, elevation_loss: 300,
  gpx_points: [
    [47.720, 11.770, 950],
    [47.722, 11.772, 900],
    [47.724, 11.774, 820],
  ],
  closed_from: '2000-01-01T00:00:00Z',
};

const GPX_TOUR = {
  id: 'gtour1', spot_id: 't1', name: 'Rundtour', direction: 'cw', duration_minutes: 90,
  distance_km: 5.5, elevation_gain: 80, elevation_loss: 720,
  trail_names: ['Talabfahrt'],
  gpx_points: [
    [47.710, 11.760, 900],
    [47.712, 11.762, 850],
    [47.714, 11.764, 780],
    [47.716, 11.766, 700],
  ],
};

async function mockGpxData(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/spot_gpx_trails**', (route) => route.fulfill({ json: [GPX_TRAIL_OPEN, GPX_TRAIL_CLOSED] }));
  await page.route('**/rest/v1/spot_gpx_tours**',  (route) => route.fulfill({ json: [GPX_TOUR] }));
}

async function openTrailPage(page: import('@playwright/test').Page) {
  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');
}

baseTest('the Touren section lists tours fetched for the spot', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  const content = page.locator('#touren');
  await expect(content).toContainText('Rundtour');
  await expect(content).toContainText('1 Trails · 90 min');
  assertNoLeaks();
});

baseTest('the Trails section lists trails fetched for the spot', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  const content = page.locator('#trails');
  await expect(content).toContainText('Talabfahrt');
  await expect(content).toContainText('Gesperrter Trail');
  assertNoLeaks();
});

baseTest('the Touren/Trails sections show the empty-state message for a spot with no GPX data', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.route('**/rest/v1/spot_gpx_trails**', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/spot_gpx_tours**',  (route) => route.fulfill({ json: [] }));
  await openTrailPage(page);

  await expect(page.locator('#touren')).toContainText('Keine Touren für diesen Spot.');
  await expect(page.locator('#trails')).toContainText('Keine Trails für diesen Spot.');
  assertNoLeaks();
});

baseTest('clicking a trail row shows the elevation panel with stats, direction and a GPX link, and marks the row active', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  const row = page.locator('#trails .spot-item[data-id="gt1"]');
  await row.click();

  await expect(row).toHaveClass(/active/);
  await expect(page.locator('#trails .spot-elevation-name')).toHaveText('Talabfahrt');
  const stats = page.locator('#trails .spot-elevation-stats');
  await expect(stats).toContainText('3.2 km');
  await expect(stats).toContainText('50 m');
  await expect(stats).toContainText('420 m');
  await expect(stats).toContainText('Nur bergab');
  await expect(page.locator('#trails .spot-elevation-download')).toHaveAttribute('href', 'https://example.com/gt1.gpx');
  await expect(page.locator('#trails .spot-elevation-chart svg')).toBeVisible();
  assertNoLeaks();
});

baseTest('clicking a tour row shows the elevation panel with the tour\'s own stats', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  const row = page.locator('#touren .spot-item[data-id="gtour1"]');
  await row.click();

  await expect(row).toHaveClass(/active/);
  await expect(page.locator('#touren .spot-elevation-name')).toHaveText('Rundtour');
  const stats = page.locator('#touren .spot-elevation-stats');
  await expect(stats).toContainText('5.5 km');
  await expect(stats).toContainText('80 m');
  await expect(stats).toContainText('720 m');
  await expect(page.locator('#touren .spot-elevation-chart svg')).toBeVisible();
  assertNoLeaks();
});

baseTest('a trail with an active closure shows the "Gesperrt" tag in the list and the status card in the elevation view', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  const row = page.locator('#trails .spot-item[data-id="gt2"]');
  await expect(row).toContainText('Gesperrt');
  await expect(row).toHaveClass(/trail-status-row-closed/);

  await row.click();
  const status = page.locator('#trails .spot-elevation-status');
  await expect(status.locator('.trail-status-info-closed')).toBeVisible();
  await expect(status).toContainText('Aktuell gesperrt');
  await expect(status).toContainText('Hinweis von Trailcrew Flowtrail Tegernsee');
  assertNoLeaks();
});

baseTest('closing the elevation panel hides it and clears the active row', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  const row = page.locator('#trails .spot-item[data-id="gt1"]');
  await row.click();
  await expect(page.locator('#trails .spot-elevation-name')).toBeVisible();

  await page.locator('#trails .spot-elevation-close').click();
  await expect(page.locator('#trails .spot-elevation-name')).toHaveCount(0);
  await expect(row).not.toHaveClass(/active/);
  assertNoLeaks();
});

baseTest('selecting a different trail row switches the elevation panel to it', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  await page.locator('#trails .spot-item[data-id="gt1"]').click();
  await expect(page.locator('#trails .spot-elevation-name')).toHaveText('Talabfahrt');

  await page.locator('#trails .spot-item[data-id="gt2"]').click();
  await expect(page.locator('#trails .spot-elevation-name')).toHaveText('Gesperrter Trail');
  await expect(page.locator('#trails .spot-item[data-id="gt1"]')).not.toHaveClass(/active/);
  await expect(page.locator('#trails .spot-item[data-id="gt2"]')).toHaveClass(/active/);
  assertNoLeaks();
});

baseTest('hovering over the elevation chart does not throw and the chart stays interactive', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  await page.locator('#trails .spot-item[data-id="gt1"]').click();

  const svg = page.locator('#trails .spot-elevation-chart svg');
  await expect(svg).toBeVisible();
  const box = await svg.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  // No crash, chart stays mounted — elevation-hover-highlights-map-marker
  // is intentionally dropped on this page (no live map to target, see the
  // spec's "Known behavior changes"); only the SVG scrubber itself is
  // asserted here.
  await expect(page.locator('#trails .spot-elevation-name')).toBeVisible();
  assertNoLeaks();
});

baseTest('Touren/Trails sections and the elevation panel render correctly on a small (mobile) viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  const row = page.locator('#trails .spot-item[data-id="gt1"]');
  await expect(row).toBeVisible();
  // Click the name text, not the row's bare center: at this width the
  // prominent distance/elevation stats widen .spot-item-right enough that
  // the row's geometric center can land on the GPX download icon
  // (.spot-item-dl, which stops propagation) instead of selecting the row.
  await row.locator('strong').click();

  await expect(page.locator('#trails .spot-elevation-name')).toBeVisible();
  await expect(page.locator('#trails .spot-elevation-name')).toHaveText('Talabfahrt');
  assertNoLeaks();
});
