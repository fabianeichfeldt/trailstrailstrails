import { test as baseTest } from '@playwright/test';
import { expect, setupAllMocks } from './fixtures';

// Covers the evolved /trails/[slug] page from the spot-detail-real-pages
// rework: a long-scroll page with real sections instead of the old thin SEO
// shell. Order (drastic-redesign follow-up): Hero -> Status -> Photos ->
// Touren/Trails/Parkplätze+Map (stacked on mobile, side-by-side from tablet
// width up) -> Beschreibung -> Kommentare -> Regeln -> Video. Phase 1 of the
// original rework — the panel-open flows this page used to link to (?trail=
// query param, search results) are still covered by tests/trail-open.spec.ts
// and stay on the SpotPanel for now; those get rewritten around real
// navigation in a later phase once marker clicks become router.push calls.

baseTest('renders the hero, embedded map, jump-nav and sections for a trail spot', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');

  await expect(page.locator('h1')).toHaveText('Flowtrail Tegernsee');
  await expect(page.locator('iframe.trail-map')).toBeVisible();
  await expect(page.locator('.spot-detail-nav')).toBeVisible();
  await expect(page.locator('#description')).toBeVisible();
  await expect(page.locator('#touren')).toBeVisible();
  await expect(page.locator('#trails')).toBeVisible();
  await expect(page.locator('#comments')).toBeVisible();

  assertNoLeaks();
});

baseTest('puts the spot name at the front of the document title and social meta', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');
  await expect(page.locator('h1')).toHaveText('Flowtrail Tegernsee');

  await expect(page).toHaveTitle('Flowtrail Tegernsee - Trailradar');
  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute(
    'content', 'Flowtrail Tegernsee - Trailradar',
  );
  await expect(page.locator('head meta[name="twitter:title"]')).toHaveAttribute(
    'content', 'Flowtrail Tegernsee - Trailradar',
  );

  // og:image must be a JPEG (WhatsApp won't render WebP) with the size hints
  // crawlers need. t1 has no photos in the mock, so it's the static card.
  await expect(page.locator('head meta[property="og:image"]')).toHaveAttribute(
    'content', 'https://trailradar.org/assets/og-default.jpg',
  );
  await expect(page.locator('head meta[property="og:image:type"]')).toHaveAttribute('content', 'image/jpeg');
  await expect(page.locator('head meta[property="og:image:width"]')).toHaveAttribute('content', '1200');

  // Canonical + og:url point at the name-slug path (t1's fixture slug === its id).
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    'href', 'https://trailradar.org/trails/t1/',
  );
  await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute(
    'content', 'https://trailradar.org/trails/t1/',
  );

  assertNoLeaks();
});

baseTest('the discovery-critical head tags land before the inlined <style> blocks', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');
  await expect(page.locator('h1')).toHaveText('Flowtrail Tegernsee');

  // WhatsApp's preview crawler only reads the first slice of <head>; the
  // hoist-seo-head Nitro plugin must keep og:*/description ahead of the CSS.
  const headHtml = await page.evaluate(() => document.head.innerHTML);
  const firstStyle = headHtml.indexOf('<style');
  for (const tag of ['<title', 'meta property="og:title"', 'meta property="og:image"', 'meta name="description"']) {
    expect(headHtml.indexOf(tag), tag).toBeGreaterThan(-1);
    expect(headHtml.indexOf(tag), `${tag} before <style>`).toBeLessThan(firstStyle);
  }

  assertNoLeaks();
});

baseTest('the "Trailradar Karte" map button links to /map?trail=id for a smooth fly-to', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');

  await expect(page.locator('a.map-all-trails-btn')).toHaveAttribute('href', '/map?trail=t1');

  assertNoLeaks();
});

baseTest('the jump-nav links target the page\'s own sections', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');

  await expect(page.locator('a[href="#description"]')).toBeVisible();
  await expect(page.locator('a[href="#touren"]')).toBeVisible();
  await expect(page.locator('a[href="#trails"]')).toBeVisible();
  await expect(page.locator('a[href="#comments"]')).toBeVisible();
  // No parking lots mocked for t1 — the link stays hidden rather than
  // pointing at an empty section.
  await expect(page.locator('a[href="#parking"]')).toHaveCount(0);

  assertNoLeaks();
});

baseTest('hides the Touren/Trails jump-links and sections for a bikepark spot', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/b1');

  await expect(page.locator('h1')).toHaveText('Bikepark Lenggries');
  await expect(page.locator('a[href="#touren"]')).toHaveCount(0);
  await expect(page.locator('a[href="#trails"]')).toHaveCount(0);
  await expect(page.locator('#touren')).toHaveCount(0);
  await expect(page.locator('#trails')).toHaveCount(0);

  assertNoLeaks();
});

baseTest('renders the empty-photos prompt once the live details fetch resolves (no status field in the mock, so no banner)', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');
  await expect(page.locator('h1')).toHaveText('Flowtrail Tegernsee');

  await expect(page.locator('.no-photos-visual')).toBeVisible();
  await expect(page.locator('.spot-status-banner')).toHaveCount(0);

  assertNoLeaks();
});

// Drastic-redesign reorder: Photos sit right under the hero/status, above
// the Touren/Trails/Map "explore" block, which itself sits above the
// Beschreibung/Kommentare tail — see app/pages/trails/[slug].vue.
baseTest('places Photos above Touren/Trails/Map, and those above Beschreibung/Kommentare', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');
  await expect(page.locator('h1')).toHaveText('Flowtrail Tegernsee');
  await expect(page.locator('#comments')).toBeVisible();

  const photosY = (await page.locator('.spot-detail-photos').boundingBox())!.y;
  const tourenY = (await page.locator('#touren').boundingBox())!.y;
  const descriptionY = (await page.locator('#description').boundingBox())!.y;
  const commentsY = (await page.locator('#comments').boundingBox())!.y;

  expect(photosY).toBeLessThan(tourenY);
  expect(tourenY).toBeLessThan(descriptionY);
  expect(descriptionY).toBeLessThan(commentsY);

  assertNoLeaks();
});

// This page's own embed (not a third-party site's) may enable dragging/
// zooming — see app/utils/embedQuery.ts's `interactive` flag.
baseTest('embeds an interactive map (drag/zoom enabled), unlike a third-party embed', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');
  await expect(page.locator('iframe.trail-map')).toBeVisible();

  const src = await page.locator('iframe.trail-map').getAttribute('src');
  expect(src).toContain('interactive=1');

  assertNoLeaks();
});

baseTest('layout stays usable on a small (mobile) viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');
  await expect(page.locator('h1')).toHaveText('Flowtrail Tegernsee');

  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.spot-detail-nav')).toBeVisible();

  // The page itself must not scroll horizontally on a narrow viewport.
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);

  // Jump-nav links and the like/share buttons stay real touch targets.
  const infoLink = page.locator('a[href="#description"]');
  const linkBox = await infoLink.boundingBox();
  expect(linkBox?.height).toBeGreaterThanOrEqual(36);

  const shareBtn = page.locator('.spot-share-btn');
  const shareBox = await shareBtn.boundingBox();
  expect(shareBox?.width).toBeGreaterThanOrEqual(44);
  expect(shareBox?.height).toBeGreaterThanOrEqual(44);

  assertNoLeaks();
});
