import { test as baseTest } from '@playwright/test';
import { expect, setupAllMocks, MOCK_SESSION, MOCK_USER } from './fixtures';

/**
 * Sign in via the AuthModal that is embedded on the /profile page.
 * The modal is opened by clicking the "Anmelden" button on the not-logged-in banner.
 * After sign-in the Vue reactive state updates and the profile layout appears —
 * no page reload needed.
 *
 * Must be called AFTER the auth mocks are overridden for the test
 * and AFTER page.goto('/profile').
 */
async function signInOnProfilePage(page: import('@playwright/test').Page) {
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: MOCK_SESSION }));
  await page.route('**/auth/v1/user**',  (route) => route.fulfill({ json: MOCK_USER }));

  await page.locator('.not-logged-in button').click();  // "Anmelden" button
  await page.locator('.auth-card input[autocomplete="email"]').fill('test@example.com');
  await page.locator('.auth-card input[autocomplete="current-password"]').fill('password123');
  await page.locator('.auth-card button[type="submit"]').click();
  // Wait for modal to close — sign-in success
  await expect(page.locator('.auth-card')).not.toBeVisible({ timeout: 6000 });
  // Wait for profile content to appear reactively
  await expect(page.locator('.profile-layout')).toBeVisible({ timeout: 6000 });
}

// ── Not logged in ──────────────────────────────────────────────────────────────

baseTest('profile page shows login prompt when not logged in', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');

  await expect(page.locator('.not-logged-in')).toBeVisible();
  await expect(page.locator('.not-logged-in')).toContainText('angemeldet sein');
  assertNoLeaks();
});

// ── Logged in ──────────────────────────────────────────────────────────────────

baseTest('profile page shows nickname and email after sign-in', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await signInOnProfilePage(page);

  await expect(page.locator('.profile-name')).toContainText('TestRider');
  await expect(page.locator('input[type="email"][readonly]')).toHaveValue('test@example.com');
  assertNoLeaks();
});

// ── Nickname update ────────────────────────────────────────────────────────────

baseTest('saving a new nickname calls updateUser with the correct name', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await signInOnProfilePage(page);

  // Register a PUT handler that captures what was sent and returns the updated user.
  // Registered after signInOnProfilePage so it takes precedence over its GET handler.
  let updateBody: Record<string, any> | null = null;
  await page.route('**/auth/v1/user**', async (route) => {
    if (route.request().method() === 'PUT') {
      try { updateBody = route.request().postDataJSON(); } catch { updateBody = null; }
      const updated = { ...MOCK_USER, user_metadata: { ...MOCK_USER.user_metadata, name: 'NewRider' } };
      route.fulfill({ json: updated });
    } else {
      route.fulfill({ json: MOCK_USER });
    }
  });

  const nicknameInput = page.locator('#profile-form input[type="text"]');
  await nicknameInput.clear();
  await nicknameInput.fill('NewRider');
  await page.locator('#profile-form button[type="submit"]').click();

  await expect.poll(() => updateBody, { timeout: 5000 }).not.toBeNull();
  expect(updateBody?.data?.name).toBe('NewRider');

  assertNoLeaks();
});

// ── Password form validation ───────────────────────────────────────────────────

baseTest('mismatched new passwords show an error without calling the API', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page);
  await page.goto('/profile');
  await page.waitForLoadState('networkidle');
  await signInOnProfilePage(page);

  // Track whether a sign-in (re-auth) call was made — it shouldn't be
  let tokenCalled = false;
  await page.route('**/auth/v1/token**', (route) => {
    tokenCalled = true;
    route.fulfill({ json: {} });
  });

  const pwInputs = page.locator('#password-form input[type="password"]');
  await pwInputs.nth(0).fill('oldpass1');    // current password
  await pwInputs.nth(1).fill('newpass1');    // new password
  await pwInputs.nth(2).fill('different2');  // new password (repeat)
  await page.locator('#password-form button[type="submit"]').click();

  await expect(page.locator('#password-form').locator('..').locator('.auth-error')).toBeVisible();
  await expect(page.locator('.auth-error')).toContainText('Passwörter stimmen nicht überein');
  expect(tokenCalled).toBe(false);

  assertNoLeaks();
});
