import { test, expect, MOCK_SESSION, MOCK_USER } from './fixtures';

// All tests start on /map (via the test fixture) with no logged-in user.

// ── Modal open / close ─────────────────────────────────────────────────────────

test('login button opens the auth modal', async ({ page }) => {
  await page.locator('[data-testid="login-btn"]').click();
  await expect(page.locator('.auth-card')).toBeVisible();
  await expect(page.locator('.auth-card h2')).toContainText('Anmelden');
});

test('cancel button closes the modal', async ({ page }) => {
  await page.locator('[data-testid="login-btn"]').click();
  await expect(page.locator('.auth-card')).toBeVisible();

  await page.locator('.auth-card .cancel').click();
  await expect(page.locator('.auth-card')).not.toBeVisible();
});

test('clicking the backdrop closes the modal', async ({ page }) => {
  await page.locator('[data-testid="login-btn"]').click();
  await expect(page.locator('.auth-card')).toBeVisible();

  // Click well outside the card (top-left of the backdrop)
  await page.locator('.auth-backdrop').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.auth-card')).not.toBeVisible();
});

// ── Mode switching ─────────────────────────────────────────────────────────────

test('clicking Registrieren switches to sign-up mode', async ({ page }) => {
  await page.locator('[data-testid="login-btn"]').click();

  await page.locator('.auth-card .switch a').click();

  await expect(page.locator('.auth-card h2')).toContainText('Konto erstellen');
  // Sign-up has a nickname field (autocomplete=username); sign-in does not
  await expect(page.locator('.auth-card input[autocomplete="username"]')).toBeVisible();
});

test('switching back to sign-in hides the nickname field', async ({ page }) => {
  await page.locator('[data-testid="login-btn"]').click();
  await page.locator('.auth-card .switch a').click(); // → sign-up
  await page.locator('.auth-card .switch a').click(); // → sign-in

  await expect(page.locator('.auth-card h2')).toContainText('Anmelden');
  await expect(page.locator('.auth-card input[autocomplete="username"]')).not.toBeVisible();
});

// ── Sign-in ────────────────────────────────────────────────────────────────────

test('wrong credentials show an error message', async ({ page }) => {
  // Override the token endpoint to return 400 for this test (takes precedence over
  // the catch-all auth mock registered in setupApiMocks — last registered wins).
  await page.route('**/auth/v1/token**', (route) =>
    route.fulfill({
      status: 400,
      json: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
    }),
  );

  await page.locator('[data-testid="login-btn"]').click();
  await page.locator('.auth-card input[autocomplete="email"]').fill('wrong@example.com');
  await page.locator('.auth-card input[autocomplete="current-password"]').fill('wrongpassword');
  await page.locator('.auth-card button[type="submit"]').click();

  await expect(page.locator('.auth-card [role="alert"]')).toBeVisible();
  await expect(page.locator('.auth-card [role="alert"]')).toContainText('Fehler beim Anmelden');
});

test('valid credentials close the modal and show the avatar', async ({ page }) => {
  // Return a real session so the Supabase client accepts the sign-in.
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: MOCK_SESSION }));
  await page.route('**/auth/v1/user**',  (route) => route.fulfill({ json: MOCK_USER }));

  await page.locator('[data-testid="login-btn"]').click();
  await page.locator('.auth-card input[autocomplete="email"]').fill('test@example.com');
  await page.locator('.auth-card input[autocomplete="current-password"]').fill('password123');
  await page.locator('.auth-card button[type="submit"]').click();

  await expect(page.locator('.auth-card')).not.toBeVisible({ timeout: 6000 });
  // Login/signup buttons are replaced by the user avatar button after sign-in
  await expect(page.locator('[data-testid="login-btn"]')).not.toBeVisible();
  await expect(page.locator('.user-avatar-btn')).toBeVisible();
});

// ── Sign-up validation ─────────────────────────────────────────────────────────

test('mismatched passwords in sign-up show an error', async ({ page }) => {
  await page.locator('[data-testid="login-btn"]').click();
  await page.locator('.auth-card .switch a').click(); // → sign-up

  await page.locator('.auth-card input[autocomplete="username"]').fill('TestUser');
  await page.locator('.auth-card input[autocomplete="email"]').fill('new@example.com');
  // Two autocomplete="new-password" inputs — fill them with different values
  const pwFields = page.locator('.auth-card input[autocomplete="new-password"]');
  await pwFields.nth(0).fill('password123');
  await pwFields.nth(1).fill('different456');
  // The input is opacity:0 / pointer-events:none — force-check it directly
  await page.locator('.consent-checkbox input[type="checkbox"]').check({ force: true });
  await page.locator('.auth-card button[type="submit"]').click();

  // Client-side validation — no API call needed
  await expect(page.locator('.auth-card [role="alert"]')).toContainText('Passwörter stimmen nicht überein');
});
