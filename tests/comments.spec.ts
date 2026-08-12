import { test, expect, MOCK_SESSION, MOCK_USER } from './fixtures';

// All tests start on /map (via the test fixture) with no logged-in user,
// same convention as auth.spec.ts / trail-open.spec.ts.

async function openTrailPanel(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="search-input"]').fill('Flow');
  await page.locator('.search-result-item').filter({ hasText: 'Flowtrail Tegernsee' }).click();
  await expect(page.locator('.spot-panel')).toHaveClass(/open/);
}

async function signIn(page: import('@playwright/test').Page) {
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: MOCK_SESSION }));
  await page.route('**/auth/v1/user**',  (route) => route.fulfill({ json: MOCK_USER }));

  await page.locator('[data-testid="login-btn"]').click();
  await page.locator('.auth-card input[autocomplete="email"]').fill('test@example.com');
  await page.locator('.auth-card input[autocomplete="current-password"]').fill('password123');
  await page.locator('.auth-card button[type="submit"]').click();
  await expect(page.locator('.auth-card')).not.toBeVisible({ timeout: 6000 });
}

const OTHER_USER_COMMENT = {
  id: 1,
  spot_id: 't1',
  user_id: 'someone-else',
  comment_text: 'Trail ist top in Schuss!',
  created_at: '2026-08-01T10:00:00Z',
  profiles: { display_name: 'Bob', avatar_url: '' },
};

const OWN_COMMENT = {
  id: 2,
  spot_id: 't1',
  user_id: MOCK_USER.id,
  comment_text: 'Mein eigener Kommentar',
  created_at: '2026-08-01T10:00:00Z',
  profiles: { display_name: 'TestRider', avatar_url: '' },
};

function makeComments(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    spot_id: 't1',
    user_id: 'someone-else',
    comment_text: `Kommentar Nr. ${i + 1}`,
    created_at: '2026-08-01T10:00:00Z',
    profiles: { display_name: 'Bob', avatar_url: '' },
  }));
}

test('comments section stays expanded by default with 3 or fewer comments', async ({ page }) => {
  await page.route('**/rest/v1/spot_comments**', (route) => route.fulfill({ json: makeComments(3) }));

  await openTrailPanel(page);

  // No click on .comments-header — the list should already be visible.
  await expect(page.locator('.comments-list')).toBeVisible();
  await expect(page.locator('.comment-row')).toHaveCount(3);
});

test('comments section stays collapsed by default with more than 3 comments', async ({ page }) => {
  await page.route('**/rest/v1/spot_comments**', (route) => route.fulfill({ json: makeComments(4) }));

  await openTrailPanel(page);

  await expect(page.locator('.comments-list')).toHaveCount(0);
  await page.locator('.comments-header').click();
  await expect(page.locator('.comments-list')).toBeVisible();
  await expect(page.locator('.comment-row')).toHaveCount(4);
});

test('anonymous user sees comments but a login prompt instead of a write box', async ({ page }) => {
  await page.route('**/rest/v1/spot_comments**', (route) => route.fulfill({ json: [OTHER_USER_COMMENT] }));

  await openTrailPanel(page);
  // Section auto-expands with only 1 comment — no need to click .comments-header.

  await expect(page.locator('.comment-row')).toContainText('Trail ist top in Schuss!');
  await expect(page.locator('.comments-login-link')).toBeVisible();
  await expect(page.locator('.comments-input')).toHaveCount(0);
  // Anonymous users have no ownership over any comment — no delete controls at all.
  await expect(page.locator('.comment-delete-btn')).toHaveCount(0);
});

test('logged-in user can post a comment and it appears with a delete control', async ({ page }) => {
  await signIn(page);
  await page.route('**/rest/v1/spot_comments**', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        json: [{
          id: 99, spot_id: 't1', user_id: MOCK_USER.id,
          comment_text: 'Endlich geflowt!', created_at: '2026-08-11T12:00:00Z',
        }],
      });
    }
    return route.fulfill({ json: [] });
  });

  await openTrailPanel(page);
  // Section auto-expands with 0 comments — no need to click .comments-header.
  await expect(page.locator('.comments-login-link')).toHaveCount(0);

  await page.locator('.comments-input').fill('Endlich geflowt!');
  await page.locator('.comments-post-btn').click();

  const row = page.locator('.comment-row').filter({ hasText: 'Endlich geflowt!' });
  await expect(row).toBeVisible();
  await expect(row.locator('.comment-delete-btn')).toBeVisible();
});

test('a logged-in user does not see a delete control on someone else\'s comment', async ({ page }) => {
  await signIn(page);
  await page.route('**/rest/v1/spot_comments**', (route) => route.fulfill({ json: [OTHER_USER_COMMENT] }));

  await openTrailPanel(page);
  // Section auto-expands with only 1 comment — no need to click .comments-header.

  const row = page.locator('.comment-row').filter({ hasText: 'Trail ist top in Schuss!' });
  await expect(row).toBeVisible();
  await expect(row.locator('.comment-delete-btn')).toHaveCount(0);
});

test('deleting a comment asks for confirmation, and cancelling keeps it', async ({ page }) => {
  await signIn(page);
  await page.route('**/rest/v1/spot_comments**', (route) => route.fulfill({ json: [OWN_COMMENT] }));

  await openTrailPanel(page);
  // Section auto-expands with only 1 comment — no need to click .comments-header.
  const row = page.locator('.comment-row').filter({ hasText: 'Mein eigener Kommentar' });
  await expect(row).toBeVisible();

  await row.locator('.comment-delete-btn').click();
  await expect(page.locator('.confirm-dialog')).toHaveClass(/confirm-dialog--open/);
  await expect(page.locator('.confirm-dialog-message')).toContainText('wirklich löschen');

  await page.locator('.confirm-dialog-cancel').click();
  await expect(page.locator('.confirm-dialog')).not.toHaveClass(/confirm-dialog--open/);
  await expect(row).toBeVisible();
});

test('confirming the delete dialog removes the comment', async ({ page }) => {
  await signIn(page);
  let deleteRequested = false;
  await page.route('**/rest/v1/spot_comments**', (route) => {
    if (route.request().method() === 'DELETE') {
      deleteRequested = true;
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ json: [OWN_COMMENT] });
  });

  await openTrailPanel(page);
  // Section auto-expands with only 1 comment — no need to click .comments-header.
  const row = page.locator('.comment-row').filter({ hasText: 'Mein eigener Kommentar' });
  await expect(row).toBeVisible();

  await row.locator('.comment-delete-btn').click();
  await page.locator('.confirm-dialog-confirm').click();

  await expect(row).toHaveCount(0);
  expect(deleteRequested).toBe(true);
});

test('the "Senden" button stays disabled until text is entered', async ({ page }) => {
  await signIn(page);
  await page.route('**/rest/v1/spot_comments**', (route) => route.fulfill({ json: [] }));

  await openTrailPanel(page);
  // Section auto-expands with 0 comments — no need to click .comments-header.

  await expect(page.locator('.comments-post-btn')).toBeDisabled();
  await page.locator('.comments-input').fill('Kurzer Kommentar');
  await expect(page.locator('.comments-post-btn')).toBeEnabled();
});
