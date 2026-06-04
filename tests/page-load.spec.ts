import { test, expect } from './fixtures';

test('map container is present', async ({ page }) => {
  await expect(page.locator('[data-testid="map-container"]')).toBeVisible();
});

test('search input is present and interactive', async ({ page }) => {
  const search = page.locator('[data-testid="search-input"]');
  await expect(search).toBeVisible();
  await expect(search).toBeEditable();
});

test('login and register buttons are visible', async ({ page }) => {
  await expect(page.locator('[data-testid="login-btn"]')).toBeVisible();
  await expect(page.locator('[data-testid="signup-btn"]')).toBeVisible();
});

test('filter checkboxes are present and checked by default', async ({ page }) => {
  // Open drawer first (filters live inside it)
  await page.locator('[data-testid="burger-btn"]').click();
  const drawer = page.locator('[data-testid="drawer"]');
  await expect(drawer).toHaveClass(/open/);

  await expect(page.locator('input[data-filter="trail"]')).toBeChecked();
  await expect(page.locator('input[data-filter="bikepark"]')).toBeChecked();
  await expect(page.locator('input[data-filter="dirtpark"]')).toBeChecked();
  await expect(page.locator('input[data-filter="pumptrack"]')).toBeChecked();
});

test('page title contains Trails', async ({ page }) => {
  await expect(page).toHaveTitle(/Trail/i);
});
