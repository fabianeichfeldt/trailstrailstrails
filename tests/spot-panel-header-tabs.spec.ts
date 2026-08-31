import { test as baseTest } from '@playwright/test';
import { test, expect, setupAllMocks, MOCK_SESSION, MOCK_USER } from './fixtures';

// E2E coverage for SpotDetailHero.vue's like/share buttons on the routed
// spot-detail page (app/pages/trails/[slug].vue). Rewritten for the
// spot-detail-real-pages rework: the panel/tab-highlight behavior this file
// used to cover no longer exists (marker clicks and search results now
// navigate to a real page instead of opening a panel with tabs — see
// tests/trail-open.spec.ts and tests/trails-detail-page.spec.ts for that
// navigation coverage, and for the "always-visible sections" coverage that
// replaces tab-switching).

async function signIn(page: import('@playwright/test').Page) {
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: MOCK_SESSION }));
  await page.route('**/auth/v1/user**',  (route) => route.fulfill({ json: MOCK_USER }));

  await page.locator('[data-testid="login-btn"]').click();
  await page.locator('.auth-card input[autocomplete="email"]').fill('test@example.com');
  await page.locator('.auth-card input[autocomplete="current-password"]').fill('password123');
  await page.locator('.auth-card button[type="submit"]').click();
  await expect(page.locator('.auth-card')).not.toBeVisible({ timeout: 6000 });
}

// ── Like button ──────────────────────────────────────────────────────────

baseTest('the like button stays hidden until the live details refresh resolves, then reveals unfilled when not liked', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  let resolveDetails!: () => void;
  const detailsGate = new Promise<void>((resolve) => { resolveDetails = resolve; });
  await page.route('**/functions/v1/**', async (route) => {
    await detailsGate;
    await route.fulfill({
      json: { data: { id: 'mock', rules: [], description: '', last_update: '2024-01-01', opening_hours: '', trail_description: '', photos: [], videos: [], likes: [] } },
    });
  });

  await page.goto('/trails/t1');
  await expect(page.locator('.spot-like-btn')).toHaveClass(/hidden/);

  resolveDetails();

  await expect(page.locator('.spot-like-btn')).not.toHaveClass(/hidden/);
  await expect(page.locator('.spot-like-btn .fa-regular.fa-star')).toBeVisible();
  assertNoLeaks();
});

baseTest('clicking the like button while signed out opens the sign-in modal', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.spot-like-btn')).not.toHaveClass(/hidden/);

  await page.locator('.spot-like-btn').click();

  await expect(page.locator('.auth-card')).toBeVisible();
  assertNoLeaks();
});

test('a logged-in user can like and unlike a trail from the hero', async ({ page }) => {
  await signIn(page);
  let liked = false;
  await page.route('**/rest/v1/trail_favorites**', (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      liked = true;
      return route.fulfill({ json: {} });
    }
    if (method === 'DELETE') {
      liked = false;
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');
  const likeBtn = page.locator('.spot-like-btn');
  await expect(likeBtn).not.toHaveClass(/hidden/);
  await expect(likeBtn.locator('.fa-regular.fa-star')).toBeVisible();

  await likeBtn.click();
  await expect(likeBtn).toContainText('⭐');
  expect(liked).toBe(true);

  await likeBtn.click();
  await expect(likeBtn.locator('.fa-regular.fa-star')).toBeVisible();
  expect(liked).toBe(false);
});

// ── Share button ─────────────────────────────────────────────────────────
// navigator.share isn't cleanly mockable via Playwright — this covers the
// clipboard-fallback path (Firefox desktop, no Web Share API), same logic
// already unit-tested in spotPanelShare.test.ts.

baseTest('share button falls back to copying the link and shows a toast when native share is unavailable', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.route('**trailradar.org/api/share**', (route) => route.fulfill({ json: {} }));
  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
  });

  await page.locator('.spot-share-btn').click();

  const toast = page.locator('.spot-share-toast');
  await expect(toast).toHaveClass(/show/);
  await expect(toast).toContainText('Link kopiert!');
  assertNoLeaks();
});
