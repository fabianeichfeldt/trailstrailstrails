import { test as baseTest } from '@playwright/test';
import { expect, setupAllMocks, MOCK_SESSION, MOCK_USER, MOCK_GOOGLE_SESSION, MOCK_GOOGLE_USER } from './fixtures';

/**
 * Sign in on the /spotmanager page by clicking the "Anmelden" button in the
 * not-logged-in banner.  The `rpcResponse` param controls what `get_my_role`
 * returns so the auth store assigns the correct dbRole before SpotManagerApp
 * mounts.
 */
async function signInOnSpotmanagerPage(
  page: import('@playwright/test').Page,
  rpcResponse: 'trailcrew' | 'admin' | null = null,
) {
  // Override RPC BEFORE sign-in so the auth store watcher picks it up
  await page.route('**/rest/v1/rpc/**', (route) =>
    route.fulfill({ json: rpcResponse }),
  );
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: MOCK_SESSION }));
  await page.route('**/auth/v1/user**',  (route) => route.fulfill({ json: MOCK_USER }));

  await page.locator('.sm-access-denied button').click();
  await page.locator('.auth-card input[autocomplete="email"]').fill('test@example.com');
  await page.locator('.auth-card input[autocomplete="current-password"]').fill('password123');
  await page.locator('.auth-card button[type="submit"]').click();
  await expect(page.locator('.auth-card')).not.toBeVisible({ timeout: 6000 });
}

// ── Not logged in ──────────────────────────────────────────────────────────────

baseTest('spotmanager shows login prompt when not logged in', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/spotmanager');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.sm-access-denied')).toBeVisible();
  await expect(page.locator('.sm-access-denied')).toContainText('einloggen');
  await expect(page.locator('.sm-access-denied button')).toBeVisible();
  assertNoLeaks();
});

// ── Regular user (wrong role) ──────────────────────────────────────────────────

baseTest('spotmanager shows access-denied for a logged-in user without trailcrew role', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/spotmanager');
  await page.waitForLoadState('networkidle');

  // Sign in with RPC returning null → dbRole stays 'user'
  await signInOnSpotmanagerPage(page, null);

  await expect(page.locator('.sm-access-denied')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.sm-access-denied')).toContainText('Kein Zugriff');
  assertNoLeaks();
});

// ── Trailcrew ─────────────────────────────────────────────────────────────────

baseTest('spotmanager renders SpotManagerApp for a trailcrew member', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/spotmanager');
  await page.waitForLoadState('networkidle');

  await signInOnSpotmanagerPage(page, 'trailcrew');

  // SpotManagerApp is visible
  await expect(page.locator('.sm-shell')).toBeVisible({ timeout: 8000 });
  // Role badge shows the current role
  await expect(page.locator('.sm-role-badge')).toContainText('trailcrew');
  // No spots assigned → empty state
  await expect(page.locator('.sm-spot-list')).toBeVisible({ timeout: 6000 });
  assertNoLeaks();
});

// ── Admin ─────────────────────────────────────────────────────────────────────

baseTest('spotmanager renders SpotManagerApp for an admin', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/spotmanager');
  await page.waitForLoadState('networkidle');

  await signInOnSpotmanagerPage(page, 'admin');

  await expect(page.locator('.sm-shell')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.sm-role-badge')).toContainText('admin');
  assertNoLeaks();
});

// ── Spot list (admin with spots) ───────────────────────────────────────────────

baseTest('spotmanager lists spots returned by the trails endpoint', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/spotmanager');
  await page.waitForLoadState('networkidle');

  // Return two spots from the admin trails query
  await page.route('**/rest/v1/trails**', (route) =>
    route.fulfill({ json: [
      { id: 'spot-1', name: 'Flowtrail Tegernsee' },
      { id: 'spot-2', name: 'Bikepark Lenggries' },
    ]}),
  );

  await signInOnSpotmanagerPage(page, 'admin');
  await expect(page.locator('.sm-shell')).toBeVisible({ timeout: 8000 });

  await expect(page.locator('.sm-spot-btn:not(.sm-embed-btn)')).toHaveCount(2, { timeout: 6000 });
  await expect(page.locator('.sm-spot-btn:not(.sm-embed-btn)').nth(0)).toContainText('Flowtrail Tegernsee');
  await expect(page.locator('.sm-spot-btn:not(.sm-embed-btn)').nth(1)).toContainText('Bikepark Lenggries');
  assertNoLeaks();
});

// ── Google OAuth: user.id vs user.sub ────────────────────────────────────────
//
// Regression guard for the bug where SpotManagerApp used authStore.user?.sub
// (Google's numeric subject) instead of authStore.getUserId (Supabase UUID).
// For Google OAuth users these values differ; the DB stores user.id.
//
// The test signs in with a session where user.sub !== user.id, mocks
// trailcrew_spots to return a spot keyed on user.id, and verifies the spot
// appears — proving user.id is used for the DB query, not user.sub.

baseTest('spotmanager loads trailcrew spots for Google OAuth user using user.id not user.sub', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/spotmanager');
  await page.waitForLoadState('networkidle');

  // Override RPC to assign trailcrew role
  await page.route('**/rest/v1/rpc/**', (route) =>
    route.fulfill({ json: 'trailcrew' }),
  );

  // Mock trailcrew_spots keyed on the Supabase UUID (user.id), not user.sub.
  // If the code used user.sub the eq() filter would not match and spots would be empty.
  await page.route('**/rest/v1/trailcrew_spots**', (route) =>
    route.fulfill({
      json: [{ spot_id: 'spot-google-1', trails: { id: 'spot-google-1', name: 'Flowtrail Google Test' } }],
    }),
  );

  // Sign in with the Google session (sub !== id)
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: MOCK_GOOGLE_SESSION }));
  await page.route('**/auth/v1/user**',  (route) => route.fulfill({ json: MOCK_GOOGLE_USER }));

  await page.locator('.sm-access-denied button').click();
  await page.locator('.auth-card input[autocomplete="email"]').fill('google@example.com');
  await page.locator('.auth-card input[autocomplete="current-password"]').fill('password123');
  await page.locator('.auth-card button[type="submit"]').click();
  await expect(page.locator('.auth-card')).not.toBeVisible({ timeout: 6000 });

  await expect(page.locator('.sm-shell')).toBeVisible({ timeout: 8000 });

  // The spot must appear — it is stored under user.id, so if user.sub were
  // used instead the list would be empty and this assertion would fail.
  await expect(page.locator('.sm-spot-btn:not(.sm-embed-btn)')).toHaveCount(1, { timeout: 6000 });
  await expect(page.locator('.sm-spot-btn:not(.sm-embed-btn)').nth(0)).toContainText('Flowtrail Google Test');

  assertNoLeaks();
});

// ── GPX upload: trail import flow ─────────────────────────────────────────────
//
// Regression guard for "ReferenceError: processGpx is not defined".
// processGpx was accidentally omitted from the import statement in
// SpotManagerApp.vue while DIFF_COLOR and the ProcessedGpx type were imported.
// This test uploads a GPX file through the "+ Trail" import view and asserts
// that the pending card with point stats appears — which requires processGpx
// to run successfully.

const MINIMAL_GPX = `<?xml version="1.0"?>
<gpx>
  <trk>
    <name>Test Trail</name>
    <trkseg>
      <trkpt lat="48.000000" lon="11.500000"><ele>500</ele></trkpt>
      <trkpt lat="48.002000" lon="11.501000"><ele>520</ele></trkpt>
      <trkpt lat="48.004000" lon="11.502000"><ele>540</ele></trkpt>
      <trkpt lat="48.006000" lon="11.503000"><ele>570</ele></trkpt>
      <trkpt lat="48.008000" lon="11.504000"><ele>600</ele></trkpt>
      <trkpt lat="48.008000" lon="11.507000"><ele>580</ele></trkpt>
      <trkpt lat="48.008000" lon="11.510000"><ele>560</ele></trkpt>
      <trkpt lat="48.008000" lon="11.513000"><ele>540</ele></trkpt>
      <trkpt lat="48.008000" lon="11.516000"><ele>520</ele></trkpt>
      <trkpt lat="48.008000" lon="11.519000"><ele>500</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

baseTest('spotmanager: uploading a GPX file through the trail import view shows a pending card with point stats', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/spotmanager');
  await page.waitForLoadState('networkidle');

  // Return one spot for the admin spot list
  await page.route('**/rest/v1/trails**', (route) =>
    route.fulfill({ json: [{ id: 'spot-1', name: 'Flowtrail Tegernsee' }] }),
  );
  // No existing trails or tours for this spot
  await page.route('**/rest/v1/spot_gpx_trails**', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/spot_gpx_tours**',  (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/trail_details**',   (route) => route.fulfill({ json: [] }));

  await signInOnSpotmanagerPage(page, 'admin');
  await expect(page.locator('.sm-shell')).toBeVisible({ timeout: 8000 });

  // Open the spot
  await page.locator('.sm-spot-btn:not(.sm-embed-btn)').first().click();
  // Wait for the trail section to render
  await expect(page.locator('.sm-section-header').filter({ hasText: 'Trails' })).toBeVisible({ timeout: 6000 });

  // Open the GPX import view via the "+ Trail" button (the Tour button comes first in the DOM)
  await page.locator('.sm-section-header').filter({ hasText: 'Trails' }).locator('.sm-btn-add').click();
  await expect(page.locator('.sm-dropzone')).toBeVisible({ timeout: 4000 });

  // Upload a GPX file through the hidden file input
  const fileInput = page.locator('input[type="file"][accept=".gpx"][multiple]');
  await fileInput.setInputFiles({
    name: 'test-trail.gpx',
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from(MINIMAL_GPX),
  });

  // The pending card must appear — this requires processGpx to execute without error
  await expect(page.locator('.sm-pending-card')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('.sm-card-stats')).toContainText('Punkte');

  assertNoLeaks();
});
