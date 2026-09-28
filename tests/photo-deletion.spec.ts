import { test, expect, MOCK_SESSION, MOCK_USER } from './fixtures';

// Role-based photo deletion on the routed spot-detail page's photo carousel
// (app/components/trail_detail/SpotDetailPhotos.vue). No existing spec
// covers photo upload/delete on this page — new file, following the same
// sign-in-then-navigate pattern as tests/comments.spec.ts and the
// role-seeding pattern (rpc override before sign-in) from
// tests/spotmanager.spec.ts.

async function openTrailPage(page: import('@playwright/test').Page) {
  await page.goto('/trails/t1');
  await page.waitForLoadState('networkidle');
}

// Signs in on the current page (started at /map by the test fixture) BEFORE
// navigating to the trail page, same ordering as comments.spec.ts's signIn
// — so the auth store already has a resolved identity by the time
// trails/[slug].vue's onMounted calls loadLiveSpotData()/loadPhotoModeration().
// `role` controls what get_my_role() (the RPC) returns, exactly like
// spotmanager.spec.ts's signInOnSpotmanagerPage.
async function signIn(page: import('@playwright/test').Page, role: 'trailcrew' | 'admin' | null = null) {
  await page.route('**/rest/v1/rpc/**', (route) => route.fulfill({ json: role }));
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: MOCK_SESSION }));
  await page.route('**/auth/v1/user**',  (route) => route.fulfill({ json: MOCK_USER }));

  await page.locator('[data-testid="login-btn"]').click();
  await page.locator('.auth-card input[autocomplete="email"]').fill('test@example.com');
  await page.locator('.auth-card input[autocomplete="current-password"]').fill('password123');
  await page.locator('.auth-card button[type="submit"]').click();
  await expect(page.locator('.auth-card')).not.toBeVisible({ timeout: 6000 });
}

const TRAIL_DETAILS_BASE = {
  id: 'mock', rules: [], description: '', last_update: '2024-01-01',
  opening_hours: '', trail_description: '', videos: [], likes: [],
};

// Live trail-details payload (the edge function response) carrying one photo
// — the baked/SSG payload only ever has id+url (no creator), so the delete
// button can only appear once this live fetch resolves. See
// app/utils/canDeletePhoto.ts and the design spec §3.
function detailsWithPhoto(photoOverrides: Partial<{ id: string; creator: string }> = {}) {
  return {
    data: {
      ...TRAIL_DETAILS_BASE,
      photos: [{
        id: 'p1',
        url: 'https://example.com/photo1.jpg',
        created_at: '2026-01-01T10:00:00Z',
        creator: MOCK_USER.id,
        profiles: { display_name: 'TestRider', avatar_url: '' },
        ...photoOverrides,
      }],
    },
  };
}

// The mock photo URL (https://example.com/photo1.jpg) is an external host
// the <img> tag actually requests — fixtures.ts's safety net blocks and
// records any unmocked external request, so this needs its own explicit
// mock in every test that renders a photo (a 1x1 PNG; pixel content is
// irrelevant to these tests).
const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function mockPhotoImage(page: import('@playwright/test').Page) {
  await page.route('https://example.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PX_PNG }),
  );
}

async function mockDeleteSucceeds(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/trail_photos**', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ json: [{ id: 'p1' }] });
    }
    return route.fulfill({ json: [] }); // baked id/url select on initial load
  });
  await page.route('**/storage/v1/object/trail-photos**', (route) => route.fulfill({ json: { message: 'ok' } }));
}

// ── Owner ────────────────────────────────────────────────────────────────

test('photo owner sees a delete control on their own photo and can remove it', async ({ page }) => {
  await signIn(page, null);
  await mockPhotoImage(page);
  await page.route('**/functions/v1/**', (route) => route.fulfill({ json: detailsWithPhoto({ creator: MOCK_USER.id }) }));
  await mockDeleteSucceeds(page);

  await openTrailPage(page);

  const deleteBtn = page.locator('.photo-delete-btn');
  await expect(deleteBtn).toBeVisible();

  await deleteBtn.click();
  await expect(page.locator('.confirm-dialog')).toHaveClass(/confirm-dialog--open/);
  await page.locator('.confirm-dialog-confirm').click();

  await expect(page.locator('.photo-wrap')).toHaveCount(0);
  await expect(page.locator('.no-photos-visual')).toBeVisible();
});

// ── Different regular user ──────────────────────────────────────────────

test('a different logged-in regular user does not see a delete control on someone else\'s photo', async ({ page }) => {
  await signIn(page, null);
  await mockPhotoImage(page);
  await page.route('**/functions/v1/**', (route) => route.fulfill({ json: detailsWithPhoto({ creator: 'someone-else' }) }));

  await openTrailPage(page);

  await expect(page.locator('.photo-wrap')).toHaveCount(1);
  await expect(page.locator('.photo-delete-btn')).toHaveCount(0);
});

// ── Trailcrew assigned to the spot ──────────────────────────────────────

test('a trailcrew member assigned to the spot sees and can delete any photo there', async ({ page }) => {
  await signIn(page, 'trailcrew');
  await mockPhotoImage(page);
  await page.route('**/rest/v1/trailcrew_spots**', (route) =>
    route.fulfill({ json: [{ spot_id: 't1' }] }),
  );
  await page.route('**/functions/v1/**', (route) => route.fulfill({ json: detailsWithPhoto({ creator: 'someone-else' }) }));
  await mockDeleteSucceeds(page);

  await openTrailPage(page);

  const deleteBtn = page.locator('.photo-delete-btn');
  await expect(deleteBtn).toBeVisible();

  await deleteBtn.click();
  await page.locator('.confirm-dialog-confirm').click();

  await expect(page.locator('.photo-wrap')).toHaveCount(0);
});

// ── Trailcrew NOT assigned to the spot ──────────────────────────────────

test('a trailcrew member not assigned to the spot does not see a delete control there', async ({ page }) => {
  await signIn(page, 'trailcrew');
  await mockPhotoImage(page);
  await page.route('**/rest/v1/trailcrew_spots**', (route) => route.fulfill({ json: [] }));
  await page.route('**/functions/v1/**', (route) => route.fulfill({ json: detailsWithPhoto({ creator: 'someone-else' }) }));

  await openTrailPage(page);

  await expect(page.locator('.photo-wrap')).toHaveCount(1);
  await expect(page.locator('.photo-delete-btn')).toHaveCount(0);
});

// ── Admin ────────────────────────────────────────────────────────────────

test('admin sees and can delete any spot\'s photos', async ({ page }) => {
  await signIn(page, 'admin');
  await mockPhotoImage(page);
  await page.route('**/functions/v1/**', (route) => route.fulfill({ json: detailsWithPhoto({ creator: 'someone-else' }) }));
  await mockDeleteSucceeds(page);

  await openTrailPage(page);

  const deleteBtn = page.locator('.photo-delete-btn');
  await expect(deleteBtn).toBeVisible();

  await deleteBtn.click();
  await page.locator('.confirm-dialog-confirm').click();

  await expect(page.locator('.photo-wrap')).toHaveCount(0);
});
