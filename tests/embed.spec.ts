import { test as base, expect } from '@playwright/test';
import { applySafetyNet, setupApiMocks } from './fixtures';

const EMBED_TRAILS = [
  { id: 't1', name: 'Flowtrail Tegernsee', type: 'trail', latitude: 47.71, longitude: 11.76, approved: true },
];

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
