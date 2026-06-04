import { test, expect } from './fixtures';

// ── Drawer open / close ────────────────────────────────────────────────────────

test('burger button opens the drawer', async ({ page }) => {
  await page.locator('[data-testid="burger-btn"]').click();
  await expect(page.locator('[data-testid="drawer"]')).toHaveClass(/open/);
});

test('drawer close button closes the drawer', async ({ page }) => {
  await page.locator('[data-testid="burger-btn"]').click();
  await expect(page.locator('[data-testid="drawer"]')).toHaveClass(/open/);

  await page.locator('[data-testid="drawer-close"]').click();
  await expect(page.locator('[data-testid="drawer"]')).not.toHaveClass(/open/);
});

test('clicking the overlay closes the drawer', async ({ page }) => {
  await page.locator('[data-testid="burger-btn"]').click();
  await expect(page.locator('[data-testid="drawer"]')).toHaveClass(/open/);

  await page.locator('[data-testid="drawer-overlay"]').click();
  await expect(page.locator('[data-testid="drawer"]')).not.toHaveClass(/open/);
});

// ── Filter checkboxes ──────────────────────────────────────────────────────────
// The checkboxes use a custom CSS toggle — the real <input> is visually hidden.
// Click the <label> wrapper (what a user would actually do).

test('unchecking bikepark filter unchecks the checkbox', async ({ page }) => {
  await page.locator('[data-testid="burger-btn"]').click();
  const cb    = page.locator('input[data-filter="bikepark"]');
  const label = page.locator('label:has(input[data-filter="bikepark"])');
  await expect(cb).toBeChecked();

  await label.click();
  await expect(cb).not.toBeChecked();
});

test('unchecking and re-checking a filter restores its state', async ({ page }) => {
  await page.locator('[data-testid="burger-btn"]').click();
  const cb    = page.locator('input[data-filter="dirtpark"]');
  const label = page.locator('label:has(input[data-filter="dirtpark"])');

  await label.click(); // unchecks — also closes drawer (intentional UX)
  await expect(cb).not.toBeChecked();

  await page.locator('[data-testid="burger-btn"]').click(); // re-open drawer
  await label.click();
  await expect(cb).toBeChecked();
});

test('each filter type can be toggled independently', async ({ page }) => {
  await page.locator('[data-testid="burger-btn"]').click();

  const bikepark      = page.locator('input[data-filter="bikepark"]');
  const dirtpark      = page.locator('input[data-filter="dirtpark"]');
  const pumptrack     = page.locator('input[data-filter="pumptrack"]');
  const bikeparkLabel = page.locator('label:has(input[data-filter="bikepark"])');

  await bikeparkLabel.click();

  // Only bikepark is unchecked — others stay checked
  await expect(bikepark).not.toBeChecked();
  await expect(dirtpark).toBeChecked();
  await expect(pumptrack).toBeChecked();
});

test('cluster toggle changes its checked state', async ({ page }) => {
  await page.locator('[data-testid="burger-btn"]').click();
  const cb    = page.locator('[data-testid="cluster-toggle"]');
  const label = page.locator('.filter-item:has([data-testid="cluster-toggle"])');
  await expect(cb).toBeChecked();

  await label.click();
  await expect(cb).not.toBeChecked();
});
