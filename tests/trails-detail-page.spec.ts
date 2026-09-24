import { test as baseTest } from '@playwright/test';
import { expect, setupAllMocks, signInOnProfilePage, navigateClientSide } from './fixtures';

// Covers the evolved /trails/[slug] page from the spot-detail-real-pages
// rework: a long-scroll page with real sections instead of the old thin SEO
// shell. Order (drastic-redesign follow-up): Hero -> Status -> Photos ->
// Touren/Trails/Parkplätze+Map (stacked on mobile, side-by-side from tablet
// width up) -> Beschreibung -> Kommentare -> Regeln -> Video. Phase 1 of the
// original rework — the panel-open flows this page used to link to (?trail=
// query param, search results) are still covered by tests/trail-open.spec.ts
// and stay on the SpotPanel for now; those get rewritten around real
// navigation in a later phase once marker clicks become router.push calls.

baseTest('renders the hero, inline map, jump-nav and sections for a trail spot', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');

  await expect(page.locator('h1')).toHaveText('Flowtrail Tegernsee');
  await expect(page.locator('[data-testid="spot-minimap"]')).toBeVisible();
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

// The Trail-Zustand card is a paid feature (FEATURES.trail_condition, Plus and up)
// and is fetched client-side in onMounted (never during prerender — see
// app/composables/useSpotWeather.ts), so only a real browser run proves the page
// wires the paywall and the fetch together. The card's own rendering logic is
// covered by vitest in SpotDetailWeather.test.ts, the access rules in
// stores/subscription.test.ts.
//
// Auth state lives in memory after signing in through the profile page's modal, so
// the signed-in cases reach the trail page by client-side navigation, not page.goto.

/** Records every request to Open-Meteo — a locked visitor must cause none. */
function trackWeatherRequests(page: import('@playwright/test').Page): string[] {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('api.open-meteo.com')) calls.push(request.url());
  });
  return calls;
}

function entitlementRows(level: number) {
  return level === 0
    ? []
    : [{ plan_id: level >= 2 ? 'pro' : 'plus', level, discount_percent: 0, early_adopter_free_until: null }];
}

baseTest('locks the Trail-Zustand card for a visitor who is not signed in, and never asks Open-Meteo', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  const weatherCalls = trackWeatherRequests(page);
  await page.goto('/trails/t1');
  await expect(page.locator('h1')).toHaveText('Flowtrail Tegernsee');

  const locked = page.locator('[data-testid="weather-locked"]');
  await expect(locked).toBeVisible();
  await expect(locked).toContainText('Plus');
  // A blurred SAMPLE is showing (its six columns are made up), but no real card.
  await expect(locked.locator('[data-testid="weather-sample"]')).toBeVisible();
  await expect(page.locator('[data-testid="weather-card"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="weather-card"] .wx-day')).toHaveCount(0);
  // Decoration only: hidden from assistive technology so no one is read a made-up verdict.
  await expect(locked.locator('.wx-sample-wrap')).toHaveAttribute('aria-hidden', 'true');
  await page.waitForLoadState('networkidle');
  expect(weatherCalls).toEqual([]);

  assertNoLeaks();
});

baseTest('locks it for a signed-in free account too', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.route('**/rest/v1/rpc/get_my_entitlement', (route) => route.fulfill({ json: entitlementRows(0) }));
  const weatherCalls = trackWeatherRequests(page);

  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await signInOnProfilePage(page);
  await navigateClientSide(page, '/trails/t1');
  await expect(page.locator('h1')).toHaveText('Flowtrail Tegernsee');

  await expect(page.locator('[data-testid="weather-locked"]')).toBeVisible();
  await expect(page.locator('[data-testid="weather-card"]')).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(weatherCalls).toEqual([]);

  assertNoLeaks();
});

baseTest('shows the weather-derived Trail-Zustand card between the status banner and the photos for a Plus account', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.route('**/rest/v1/rpc/get_my_entitlement', (route) => route.fulfill({ json: entitlementRows(1) }));

  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await signInOnProfilePage(page);
  await navigateClientSide(page, '/trails/t1');
  await expect(page.locator('h1')).toHaveText('Flowtrail Tegernsee');

  await expect(page.locator('[data-testid="weather-locked"]')).toHaveCount(0);
  const card = page.locator('[data-testid="weather-card"]');
  await expect(card).toBeVisible();
  // The mock has 4mm two days ago and mild weather since — solidly grippy.
  await expect(card).toContainText('Hero Dirt');
  await expect(card).toContainText('Open-Meteo');
  // Six columns: two measured days, today, three forecast days.
  await expect(card.locator('.wx-day')).toHaveCount(6);
  await expect(card.locator('.wx-day').nth(2)).toHaveClass(/today/);
  await expect(card.locator('.wx-day.forecast')).toHaveCount(3);

  const weatherY = (await card.boundingBox())!.y;
  const photosY = (await page.locator('.spot-detail-photos').boundingBox())!.y;
  expect(weatherY).toBeLessThan(photosY);

  assertNoLeaks();
});

// The spot page's own inline map is interactive (drag/zoom enabled), unlike
// a third-party embed — createMiniMap({ interactive: true }) in
// SpotDetailMiniMap.vue. The Leaflet zoom control only renders when
// zoomControl (=== interactive) is on, so its presence proves it.
baseTest('renders an interactive inline map (drag/zoom enabled), unlike a third-party embed', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/trails/t1');

  const miniMap = page.locator('[data-testid="spot-minimap"]');
  await expect(miniMap).toBeVisible();
  await expect(miniMap.locator('.leaflet-control-zoom')).toBeVisible();

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
