import { test, expect } from './fixtures';

test('typing a trail name shows matching results', async ({ page }) => {
  await page.locator('#search').fill('Flow');

  const results = page.locator('#search-results');
  await expect(results).toBeVisible();
  await expect(results).toContainText('Flowtrail Tegernsee');
});

test('typing a bikepark name shows it in results', async ({ page }) => {
  await page.locator('#search').fill('Bikepark');
  await expect(page.locator('#search-results')).toContainText('Bikepark Lenggries');
});

test('results section shows category separator for trails', async ({ page }) => {
  await page.locator('#search').fill('Flow');

  // Wait for results, then check the separator — Nominatim is mocked empty in
  // fixtures so only one separator ("Trails & Parks") can ever appear here.
  await expect(page.locator('#search-results')).toBeVisible();
  await expect(page.locator('.search-result-separator').first()).toContainText('Trails & Parks');
});

test('unknown query shows empty-state message', async ({ page }) => {
  await page.locator('#search').fill('xyzunknown123');
  await expect(page.locator('#search-results')).toContainText('Keine Ergebnisse');
});

test('clear button hides search results', async ({ page }) => {
  await page.locator('#search').fill('Flow');
  await expect(page.locator('#search-results')).toBeVisible();

  await page.locator('#search-clear').click();

  await expect(page.locator('#search-results')).not.toBeVisible();
  await expect(page.locator('#search')).toHaveValue('');
});

test('short query (< 2 chars) shows no results', async ({ page }) => {
  await page.locator('#search').fill('F');
  await expect(page.locator('#search-results')).not.toHaveClass(/visible/);
});
