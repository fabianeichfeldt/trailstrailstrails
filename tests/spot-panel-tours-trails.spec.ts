import { test as baseTest } from '@playwright/test';
import { expect, setupAllMocks } from './fixtures';

// E2E coverage for the Touren/Trails sections and the elevation panel on
// the routed spot-detail page (app/pages/trails/[slug].vue). Rewritten for
// the spot-detail-real-pages rework: Touren/Trails are always-visible
// sections (not switched-to tabs — see SpotDetailNav.vue), and the
// elevation view is mounted inline directly after whichever row is
// selected (SpotPanelTrailsTab.vue/SpotPanelToursTab.vue each render it
// inside their own v-for, right after the matching row) — not after the
// whole list, and not a CSS-toggled overlay inside a fixed panel shell.
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

  await expect(page.locator('#touren')).toContainText('Die GPX-Daten zu diesem Spot wurden noch nicht hochgeladen.');
  await expect(page.locator('#trails')).toContainText('Die GPX-Daten zu diesem Spot wurden noch nicht hochgeladen.');
  assertNoLeaks();
});

baseTest('clicking a trail row shows the elevation panel with a chart, and marks the row active', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  const row = page.locator('#trails .spot-item[data-id="gt1"]');
  await row.click();

  await expect(row).toHaveClass(/active/);
  await expect(page.locator('#trails .spot-elevation-chart svg')).toBeVisible();
  // Distance/elevation/direction stats and the redundant GPX download button
  // (the row itself already has one) were dropped from this panel as noise.
  await expect(page.locator('#trails .spot-elevation-stats')).toHaveCount(0);
  await expect(page.locator('#trails .spot-elevation-download')).toHaveCount(0);
  assertNoLeaks();
});

baseTest('clicking a trail row inserts the elevation panel directly after that row, not at the end of the list', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  await page.locator('#trails .spot-item[data-id="gt1"]').click();

  const children = page.locator('#trails > *');
  await expect(children.nth(1)).toHaveAttribute('data-id', 'gt1');
  await expect(children.nth(2)).toHaveClass(/spot-elevation/);
  await expect(children.nth(3)).toHaveAttribute('data-id', 'gt2');
  assertNoLeaks();
});

baseTest('clicking a trail row flies the embedded map to that trail\'s midpoint at zoom 14, without reloading the iframe', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  const iframeEl = page.locator('iframe.trail-map');
  const srcBefore = await iframeEl.getAttribute('src');

  // Listen for the raw postMessage inside the iframe's own window — this
  // is the contract between the parent page and app/pages/embed/[token].vue,
  // independent of whether the embed's own data fetch succeeds. Locator's
  // own contentFrame() returns a FrameLocator (no evaluate()) — the actual
  // Frame, which does, comes from the underlying ElementHandle instead.
  const frame = await (await iframeEl.elementHandle())!.contentFrame();
  const messagePromise = frame!.evaluate(() => new Promise((resolve) => {
    window.addEventListener('message', (e) => resolve(e.data), { once: true });
  }));

  await page.locator('#trails .spot-item[data-id="gt1"]').click();

  // gt1's gpx_points run from [47.710, 11.760] to [47.716, 11.766] — the
  // midpoint of start and end, not a centroid of every point.
  await expect(messagePromise).resolves.toEqual({ type: 'trailradar:flyTo', lat: 47.713, lng: 11.763, zoom: 14 });

  // The iframe itself never reloaded — src is unchanged (flyTo happens via
  // the message above, not by swapping the iframe's src).
  await expect(iframeEl).toHaveAttribute('src', srcBefore!);
  assertNoLeaks();
});

baseTest('clicking a tour row shows the elevation panel with a chart', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  const row = page.locator('#touren .spot-item[data-id="gtour1"]');
  await row.click();

  await expect(row).toHaveClass(/active/);
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
  await expect(page.locator('#trails .spot-elevation')).toBeVisible();

  await page.locator('#trails .spot-elevation-close').click();
  await expect(page.locator('#trails .spot-elevation')).toHaveCount(0);
  await expect(row).not.toHaveClass(/active/);
  assertNoLeaks();
});

baseTest('selecting a different trail row switches the elevation panel to it', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await mockGpxData(page);
  await openTrailPage(page);

  await page.locator('#trails .spot-item[data-id="gt1"]').click();
  await expect(page.locator('#trails .spot-elevation')).toHaveCount(1);

  await page.locator('#trails .spot-item[data-id="gt2"]').click();
  // Only one panel at a time, and it now sits after gt2 (the last row),
  // not after gt1 any more.
  await expect(page.locator('#trails .spot-elevation')).toHaveCount(1);
  const children = page.locator('#trails > *');
  await expect(children.last()).toHaveClass(/spot-elevation/);
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
  await expect(page.locator('#trails .spot-elevation')).toBeVisible();
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

  await expect(page.locator('#trails .spot-elevation-chart svg')).toBeVisible();
  assertNoLeaks();
});
