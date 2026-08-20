import { test, expect } from './fixtures';

// E2E coverage for Tours/Trails tab switching, tour/trail selection, and
// the elevation panel.

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

test('selecting a trail at mobile width snaps the sheet to full height and the elevation view fully covers the list (drill-in, not a squeeze)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await mockGpxData(page);
  await openTrailPanel(page);

  const panelBoxBefore = await page.locator('.spot-panel').boundingBox();
  expect(panelBoxBefore).not.toBeNull();
  const beforeVh = (panelBoxBefore!.height / 700) * 100;
  expect(beforeVh).toBeLessThan(70); // still at the default 'half' (56vh), not already expanded

  await page.locator('.spot-tab[data-tab="trails"]').click();
  await page.locator('.spot-item[data-id="gt1"]').click();
  await page.waitForTimeout(350); // let the height transition finish

  const panelBoxAfter = await page.locator('.spot-panel').boundingBox();
  expect(panelBoxAfter).not.toBeNull();
  const afterVh = (panelBoxAfter!.height / 700) * 100;
  expect(afterVh).toBeGreaterThan(85); // snapped to ~92vh ('full')

  // The elevation overlay fills exactly the area the list used to occupy —
  // confirms a drill-in replace, not a flex sibling squeezing the list.
  const contentArea = await page.locator('.spot-panel-content-area').boundingBox();
  const elevationPanel = await page.locator('.spot-elevation-panel').boundingBox();
  expect(contentArea).not.toBeNull();
  expect(elevationPanel).not.toBeNull();
  expect(elevationPanel!.height).toBeCloseTo(contentArea!.height, 0);
});

test('dragging the handle upward snaps the sheet toward full height, not wherever the drag ended', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await mockGpxData(page);
  await openTrailPanel(page);
  // Let the panel's own 0.32s open-slide transition settle before reading
  // the handle's position — grabbing it mid-slide races the animation and
  // the drag starts on stale coordinates that no longer land on the handle.
  await page.waitForTimeout(400);

  const handle = page.locator('.spot-panel-handle');
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  const startX = handleBox!.x + handleBox!.width / 2;
  const startY = handleBox!.y + handleBox!.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Drag most of the way toward the top — short of the exact 92vh target,
  // to prove release snaps rather than just stopping at the drag height.
  await page.mouse.move(startX, 120, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(350); // let the height transition finish

  const panelBox = await page.locator('.spot-panel').boundingBox();
  expect(panelBox).not.toBeNull();
  const heightVh = (panelBox!.height / 700) * 100;
  expect(heightVh).toBeGreaterThan(85);
});

test('tapping the handle (no drag) cycles the sheet through peek, full and back to half', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await mockGpxData(page);
  await openTrailPanel(page);
  await page.waitForTimeout(400); // let the open-slide settle before the first tap

  const handle = page.locator('.spot-panel-handle');
  const heightVh = async () => ((await page.locator('.spot-panel').boundingBox())!.height / 700) * 100;

  expect(await heightVh()).toBeLessThan(70); // starts at the default 'half' (56vh)

  await handle.click();
  await page.waitForTimeout(300);
  expect(await heightVh()).toBeGreaterThan(85); // half -> full

  await handle.click();
  await page.waitForTimeout(300);
  expect(await heightVh()).toBeLessThan(25); // full -> peek

  await handle.click();
  await page.waitForTimeout(300);
  const backToHalf = await heightVh();
  expect(backToHalf).toBeGreaterThan(45);
  expect(backToHalf).toBeLessThan(70); // peek -> half, cycle wraps
});
