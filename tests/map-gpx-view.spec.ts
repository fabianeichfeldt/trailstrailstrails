import { test as baseTest } from '@playwright/test';
import { expect, setupAllMocks, MOCK_TRAILS, MOCK_BIKEPARKS, MOCK_DIRTPARKS } from './fixtures';

// Zoomed-in GPX view on /map: spots with GPX tracks must keep their own pin
// (it marks the spot centre), not only spots without tracks.

const GPX_TRAIL = {
  spot_id: 't1', name: 'Talabfahrt', difficulty: 'blue',
  gpx_points: [
    [47.710, 11.760, 900],
    [47.712, 11.762, 850],
    [47.714, 11.764, 780],
  ],
};

baseTest('a spot with GPX tracks keeps its pin next to the tracks in the GPX view', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.route('**/rest/v1/spot_gpx_trails**', (route) => route.fulfill({ json: [GPX_TRAIL] }));

  // ?trail= flies to the spot at a zoom past GPX_ZOOM_THRESHOLD.
  await page.goto('/map?trail=t1');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500); // let the flyTo finish and the GPX view render

  await expect(page.locator('.leaflet-overlay-pane path').first()).toBeVisible();
  // Every spot keeps its pin: t1 (with GPX) as well as the spots without.
  const allSpots = MOCK_TRAILS.length + MOCK_BIKEPARKS.length + MOCK_DIRTPARKS.length;
  await expect(page.locator('.leaflet-marker-pane .map-pin')).toHaveCount(allSpots);

  assertNoLeaks();
});
