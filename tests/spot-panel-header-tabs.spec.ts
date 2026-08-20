import { test, expect, MOCK_SESSION, MOCK_USER } from './fixtures';

// E2E coverage for the header's like/share buttons and tab-button
// highlighting (tab-content switching itself has partial incidental
// coverage in spot-panel-tours-trails.spec.ts / spot-panel-parking.spec.ts).

async function openTrailPanel(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await expect(page.locator('.spot-panel')).toHaveClass(/open/);
}

// Mirrors comments.spec.ts's signIn() helper — same mock session/user, same
// login-form flow. Not imported (each spec file keeps its own copy, matching
// this repo's existing convention across the spot-panel specs).
async function signIn(page: import('@playwright/test').Page) {
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: MOCK_SESSION }));
  await page.route('**/auth/v1/user**',  (route) => route.fulfill({ json: MOCK_USER }));

  await page.locator('[data-testid="login-btn"]').click();
  await page.locator('.auth-card input[autocomplete="email"]').fill('test@example.com');
  await page.locator('.auth-card input[autocomplete="current-password"]').fill('password123');
  await page.locator('.auth-card button[type="submit"]').click();
  await expect(page.locator('.auth-card')).not.toBeVisible({ timeout: 6000 });
}

// ── Tabs ─────────────────────────────────────────────────────────────────

test('the Info tab button is highlighted by default and switching tabs moves the highlight', async ({ page }) => {
  await openTrailPanel(page);

  await expect(page.locator('.spot-tab[data-tab="info"]')).toHaveClass(/active/);

  await page.locator('.spot-tab[data-tab="tours"]').click();

  await expect(page.locator('.spot-tab[data-tab="tours"]')).toHaveClass(/active/);
  await expect(page.locator('.spot-tab[data-tab="info"]')).not.toHaveClass(/active/);
  await expect(page.locator('#spot-tours-tab')).not.toHaveClass(/hidden/);
  await expect(page.locator('#spot-info-tab')).toHaveClass(/hidden/);
});

test('header and tabs render correctly on a small (mobile) viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await openTrailPanel(page);

  await expect(page.locator('.spot-panel-title')).toBeVisible();
  await expect(page.locator('.spot-tab[data-tab="info"]')).toBeVisible();

  await page.locator('.spot-tab[data-tab="trails"]').click();
  await expect(page.locator('.spot-tab[data-tab="trails"]')).toHaveClass(/active/);
});

// ── Like button ──────────────────────────────────────────────────────────

test('the like button stays hidden until the Info tab data loads, then reveals unfilled when not liked', async ({ page }) => {
  let resolveDetails!: () => void;
  const detailsGate = new Promise<void>((resolve) => { resolveDetails = resolve; });
  await page.route('**/functions/v1/**', async (route) => {
    await detailsGate;
    await route.fulfill({
      json: { data: { id: 'mock', rules: [], description: '', last_update: '2024-01-01', opening_hours: '', trail_description: '', photos: [], videos: [], likes: [] } },
    });
  });

  await openTrailPanel(page);

  await expect(page.locator('.spot-like-btn')).toHaveClass(/hidden/);

  resolveDetails();

  await expect(page.locator('.spot-like-btn')).not.toHaveClass(/hidden/);
  await expect(page.locator('.spot-like-btn .fa-regular.fa-star')).toBeVisible();
});

test('clicking the like button while signed out opens the sign-in modal', async ({ page }) => {
  await openTrailPanel(page);
  await expect(page.locator('.spot-like-btn')).not.toHaveClass(/hidden/);

  await page.locator('.spot-like-btn').click();

  await expect(page.locator('.auth-card')).toBeVisible();
});

test('a logged-in user can like and unlike a trail from the header', async ({ page }) => {
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

  await openTrailPanel(page);
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

test('share button falls back to copying the link and shows a toast when native share is unavailable', async ({ page }) => {
  await openTrailPanel(page);
  await page.route('**trailradar.org/api/share**', (route) => route.fulfill({ json: {} }));
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true });
  });

  await page.locator('.spot-share-btn').click();

  const toast = page.locator('.spot-share-toast');
  await expect(toast).toHaveClass(/show/);
  await expect(toast).toContainText('Link kopiert!');
});
