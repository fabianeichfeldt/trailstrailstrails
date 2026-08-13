import { test, expect } from './fixtures';

// Safety net for the Phase 3 spot-panel-to-Vue migration (see
// docs/superpowers/specs/2026-08-13-spot-panel-vue-migration-design.md).
// Before this spec, Tours/Trails tab switching, tour/trail selection, and
// the elevation panel had zero E2E coverage.

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

async function openTrailPanel(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await expect(page.locator('.spot-panel')).toHaveClass(/open/);
}

test('the Tours tab lists tours fetched for the spot', async ({ page }) => {
  await mockGpxData(page);
  await openTrailPanel(page);

  await page.locator('.spot-tab[data-tab="tours"]').click();
  const content = page.locator('#spot-tours-tab');
  await expect(content).toContainText('Rundtour');
  await expect(content).toContainText('1 Trails · 90 min');
});

test('the Trails tab lists trails fetched for the spot', async ({ page }) => {
  await mockGpxData(page);
  await openTrailPanel(page);

  await page.locator('.spot-tab[data-tab="trails"]').click();
  const content = page.locator('#spot-trails-tab');
  await expect(content).toContainText('Talabfahrt');
  await expect(content).toContainText('Gesperrter Trail');
});

test('the Tours/Trails tabs show the empty-state message for a spot with no GPX data', async ({ page }) => {
  await page.route('**/rest/v1/spot_gpx_trails**', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/spot_gpx_tours**',  (route) => route.fulfill({ json: [] }));
  await openTrailPanel(page);

  await page.locator('.spot-tab[data-tab="tours"]').click();
  await expect(page.locator('#spot-tours-tab')).toContainText('Keine Touren für diesen Spot.');

  await page.locator('.spot-tab[data-tab="trails"]').click();
  await expect(page.locator('#spot-trails-tab')).toContainText('Keine Trails für diesen Spot.');
});

test('clicking a trail row shows the elevation panel with stats, direction and a GPX link, and marks the row active', async ({ page }) => {
  await mockGpxData(page);
  await openTrailPanel(page);

  await page.locator('.spot-tab[data-tab="trails"]').click();
  const row = page.locator('.spot-item[data-id="gt1"]');
  await row.click();

  await expect(row).toHaveClass(/active/);
  const elevationPanel = page.locator('.spot-elevation-panel');
  await expect(elevationPanel).not.toHaveClass(/hidden/);
  await expect(elevationPanel.locator('.spot-elevation-name')).toHaveText('Talabfahrt');
  const stats = elevationPanel.locator('.spot-elevation-stats');
  await expect(stats).toContainText('3.2 km');
  await expect(stats).toContainText('50 m');
  await expect(stats).toContainText('420 m');
  await expect(stats).toContainText('Nur bergab');
  await expect(elevationPanel.locator('.spot-elevation-download')).toHaveAttribute('href', 'https://example.com/gt1.gpx');
  await expect(elevationPanel.locator('.spot-elevation-chart svg')).toBeVisible();
});

test('clicking a tour row shows the elevation panel with the tour\'s own stats', async ({ page }) => {
  await mockGpxData(page);
  await openTrailPanel(page);

  await page.locator('.spot-tab[data-tab="tours"]').click();
  const row = page.locator('.spot-item[data-id="gtour1"]');
  await row.click();

  await expect(row).toHaveClass(/active/);
  const elevationPanel = page.locator('.spot-elevation-panel');
  await expect(elevationPanel).not.toHaveClass(/hidden/);
  await expect(elevationPanel.locator('.spot-elevation-name')).toHaveText('Rundtour');
  const stats = elevationPanel.locator('.spot-elevation-stats');
  await expect(stats).toContainText('5.5 km');
  await expect(stats).toContainText('80 m');
  await expect(stats).toContainText('720 m');
  await expect(elevationPanel.locator('.spot-elevation-chart svg')).toBeVisible();
});

test('a trail with an active closure shows the "Gesperrt" tag in the list and the status card in the elevation view', async ({ page }) => {
  await mockGpxData(page);
  await openTrailPanel(page);

  await page.locator('.spot-tab[data-tab="trails"]').click();
  const row = page.locator('.spot-item[data-id="gt2"]');
  await expect(row).toContainText('Gesperrt');
  await expect(row).toHaveClass(/trail-status-row-closed/);

  await row.click();
  const status = page.locator('.spot-elevation-status');
  await expect(status.locator('.trail-status-info-closed')).toBeVisible();
  await expect(status).toContainText('Aktuell gesperrt');
  await expect(status).toContainText('Hinweis von Trailcrew Flowtrail Tegernsee');
});

test('closing the elevation panel hides it and clears the active row', async ({ page }) => {
  await mockGpxData(page);
  await openTrailPanel(page);

  await page.locator('.spot-tab[data-tab="trails"]').click();
  const row = page.locator('.spot-item[data-id="gt1"]');
  await row.click();
  await expect(page.locator('.spot-elevation-panel')).not.toHaveClass(/hidden/);

  await page.locator('.spot-elevation-close').click();
  await expect(page.locator('.spot-elevation-panel')).toHaveClass(/hidden/);
  await expect(row).not.toHaveClass(/active/);
});

test('switching from the Trails tab to another tab closes the elevation panel', async ({ page }) => {
  await mockGpxData(page);
  await openTrailPanel(page);

  await page.locator('.spot-tab[data-tab="trails"]').click();
  await page.locator('.spot-item[data-id="gt1"]').click();
  await expect(page.locator('.spot-elevation-panel')).not.toHaveClass(/hidden/);

  await page.locator('.spot-tab[data-tab="tours"]').click();
  await expect(page.locator('.spot-elevation-panel')).toHaveClass(/hidden/);
});

test('hovering over the elevation chart does not throw and the chart stays interactive', async ({ page }) => {
  await mockGpxData(page);
  await openTrailPanel(page);

  await page.locator('.spot-tab[data-tab="trails"]').click();
  await page.locator('.spot-item[data-id="gt1"]').click();

  const svg = page.locator('.spot-elevation-chart svg');
  await expect(svg).toBeVisible();
  const box = await svg.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  // No crash, panel still visible — precise hover-marker placement on the
  // Leaflet map is not asserted here (not practical/valuable via Playwright).
  await expect(page.locator('.spot-elevation-panel')).not.toHaveClass(/hidden/);
});

test('Tours/Trails tabs and the elevation panel render correctly on a small (mobile) viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await mockGpxData(page);
  await openTrailPanel(page);

  await page.locator('.spot-tab[data-tab="trails"]').click();
  const row = page.locator('.spot-item[data-id="gt1"]');
  await expect(row).toBeVisible();
  await row.click();

  await expect(page.locator('.spot-elevation-panel')).toBeVisible();
  await expect(page.locator('.spot-elevation-name')).toHaveText('Talabfahrt');
});
