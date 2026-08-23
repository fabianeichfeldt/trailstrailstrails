import { test as base, expect } from '@playwright/test';
import { applySafetyNet, setupApiMocks } from './fixtures';

const EMBED_TRAILS = [
  {
    id: 't1', name: 'Flowtrail Tegernsee', type: 'trail', latitude: 47.71, longitude: 11.76, approved: true,
    gpx_trails: [], gpx_tours: [], parking: [],
  },
];

const EMBED_TRAIL_WITH_GPX = {
  id: 't1', name: 'Flowtrail Tegernsee', type: 'trail', latitude: 47.71, longitude: 11.76, approved: true,
  gpx_trails: [{
    name: 'Hauptlinie', difficulty: 'blue',
    gpx_points: [[47.71, 11.76, 600], [47.711, 11.761, 610], [47.712, 11.762, 615]],
  }],
  gpx_tours: [],
  parking: [{ id: 'p1', name: 'Talstation Parkplatz', lat: 47.709, lng: 11.758 }],
};

const embedTest = base.extend<{ page: base.PlaywrightTestArgs['page'] }>({
  page: async ({ page }, use) => {
    const assertNoLeaks = await applySafetyNet(page);
    await setupApiMocks(page);
    await use(page);
    assertNoLeaks();
  },
});

embedTest('embed page renders map and markers with a valid token', async ({ page }) => {
  await page.route('**/_embed/**', route =>
    route.fulfill({ json: EMBED_TRAILS }),
  );

  await page.goto('/embed/test-token?lat=47.71&lng=11.76&zoom=12');
  await page.waitForLoadState('networkidle');

  // The map container is rendered (no error overlay)
  await expect(page.locator('.embed-map')).toBeVisible();
  await expect(page.locator('.embed-error')).not.toBeVisible();
});

embedTest('embed page shows error overlay when API returns 403', async ({ page }) => {
  await page.route('**/_embed/**', route =>
    route.fulfill({
      status: 403,
      json: { statusMessage: 'HOST_NOT_ALLOWED' },
    }),
  );

  await page.goto('/embed/bad-token');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.embed-error')).toBeVisible();
  await expect(page.locator('.embed-error-msg')).toContainText('nicht autorisiert');
});

embedTest('embed page shows error overlay for unknown token', async ({ page }) => {
  await page.route('**/_embed/**', route =>
    route.fulfill({
      status: 403,
      json: { statusMessage: 'TOKEN_NOT_FOUND' },
    }),
  );

  await page.goto('/embed/nonexistent');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.embed-error')).toBeVisible();
  await expect(page.locator('.embed-error-msg')).toContainText('Ungültiger');
});

embedTest('embed page shows error overlay for inactive token', async ({ page }) => {
  await page.route('**/_embed/**', route =>
    route.fulfill({
      status: 403,
      json: { statusMessage: 'TOKEN_INACTIVE' },
    }),
  );

  await page.goto('/embed/inactive-token');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.embed-error')).toBeVisible();
  await expect(page.locator('.embed-error-msg')).toContainText('deaktiviert');
});

// Regression test for "the embedded map shows the wrong location" — the
// existing tests above only check that *a* map renders (no error overlay),
// never that it's centered where it was actually asked to be. If lat/lng
// ever silently fall back to embedQuery.ts's DEFAULT_LAT/DEFAULT_LNG (the
// exact bug this page was fixed for once already — see the comment in
// app/pages/embed/[token].vue), every embed would render a real, valid-
// looking map, just centered near Salzburg instead of the requested spot —
// something none of the other assertions here would ever catch. This test
// reads the actual OSM tile requests the map makes and decodes them back to
// lat/lng, so it verifies what's really on screen, not just the URL we
// asked for.
embedTest('embed page renders map tiles centered on the requested coordinates, not the embed-query default', async ({ page }) => {
  await page.route('**/_embed/**', route =>
    route.fulfill({ json: EMBED_TRAILS }),
  );

  const tileUrls: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('tile.openstreetmap.org')) tileUrls.push(req.url());
  });

  // t1's real coordinates (47.71, 11.76) are ~85km from embedQuery.ts's
  // DEFAULT_LAT/DEFAULT_LNG (47.8, 13.0) — easily distinguishable.
  await page.goto('/embed/test-token?lat=47.71&lng=11.76&zoom=11');
  await page.waitForLoadState('networkidle');

  expect(tileUrls.length).toBeGreaterThan(0);
  const match = tileUrls[0].match(/\/(\d+)\/(\d+)\/(\d+)\.png/);
  expect(match).not.toBeNull();
  const [, zStr, xStr, yStr] = match!;
  const n = 2 ** Number(zStr);
  const lng = Number(xStr) / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * Number(yStr) / n))) * 180 / Math.PI;

  expect(lat).toBeGreaterThan(47.4);
  expect(lat).toBeLessThan(48.0);
  expect(lng).toBeGreaterThan(11.4);
  expect(lng).toBeLessThan(12.1);
});

embedTest('embed map drag and scroll-wheel zoom are disabled', async ({ page }) => {
  await page.route('**/_embed/**', route =>
    route.fulfill({ json: EMBED_TRAILS }),
  );

  await page.goto('/embed/test-token?lat=47.71&lng=11.76&zoom=12');
  await page.waitForLoadState('networkidle');

  const getPaneTransform = () =>
    page.evaluate(() => document.querySelector<HTMLElement>('.leaflet-map-pane')?.style.transform ?? '');

  const before = await getPaneTransform();

  // Attempt drag — pane transform must not change
  const box = await page.locator('.embed-map').boundingBox();
  const cx = box!.x + box!.width / 2;
  const cy = box!.y + box!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 150, cy + 100, { steps: 10 });
  await page.mouse.up();
  expect(await getPaneTransform()).toBe(before);

  // Attempt scroll zoom — pane transform must not change
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(300);
  expect(await getPaneTransform()).toBe(before);
});

embedTest('embed page shows the GPX track and drops the spot marker when zoom is high enough', async ({ page }) => {
  await page.route('**/_embed/**', route =>
    route.fulfill({ json: [EMBED_TRAIL_WITH_GPX] }),
  );

  // zoom=12 is above GPX_ZOOM_THRESHOLD (11), and the trail has GPX data.
  await page.goto('/embed/test-token?lat=47.71&lng=11.76&zoom=12');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.leaflet-overlay-pane path').first()).toBeVisible();
  await expect(page.locator('.map-pin')).toHaveCount(0);
});

embedTest('embed page shows only the spot marker (no GPX) when zoom is below the threshold', async ({ page }) => {
  await page.route('**/_embed/**', route =>
    route.fulfill({ json: [EMBED_TRAIL_WITH_GPX] }),
  );

  // zoom=8 is below GPX_ZOOM_THRESHOLD (11) even though the trail has GPX data.
  await page.goto('/embed/test-token?lat=47.71&lng=11.76&zoom=8');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.map-pin')).toHaveCount(1);
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(0);
});

embedTest('embed page always renders parking markers, regardless of zoom or GPX state', async ({ page }) => {
  await page.route('**/_embed/**', route =>
    route.fulfill({ json: [EMBED_TRAIL_WITH_GPX] }),
  );

  await page.goto('/embed/test-token?lat=47.71&lng=11.76&zoom=8');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.parking-pin')).toHaveCount(1);
});
