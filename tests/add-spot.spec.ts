import { test as baseTest } from '@playwright/test'
import { expect, setupAllMocks, MOCK_SESSION, MOCK_USER } from './fixtures'

const CREATED_TRAIL = {
  id: 'new-trail-1',
  name: 'Flowtrail Test',
  type: 'trail',
  latitude: 48.05,
  longitude: 11.55,
  approved: false,
}

/** Signs in on the /map page through the UserAvatar login button. */
async function signInOnMapPage(
  page: import('@playwright/test').Page,
) {
  await page.route('**/auth/v1/token**', (route) => route.fulfill({ json: MOCK_SESSION }))
  await page.route('**/auth/v1/user**', (route) => route.fulfill({ json: MOCK_USER }))
  await page.route('**/rest/v1/rpc/**', (route) => route.fulfill({ json: null }))

  await page.locator('[data-testid="login-btn"]').click()
  await page.locator('.auth-card input[autocomplete="email"]').fill('test@example.com')
  await page.locator('.auth-card input[autocomplete="current-password"]').fill('password123')
  await page.locator('.auth-card button[type="submit"]').click()
  await expect(page.locator('.auth-card')).not.toBeVisible({ timeout: 6000 })
}

/** Enters add mode for the given spot type (clicks + → type item). */
async function enterAddMode(page: import('@playwright/test').Page, type: 'trail' | 'bikepark' | 'dirtpark') {
  await page.locator('#add-btn').click()
  await page.locator(`.fab-item[data-type="${type}"]`).click()
}

/** Clicks the Leaflet map container to pick a location in add mode. */
async function clickMap(page: import('@playwright/test').Page) {
  const mapEl = page.locator('[data-testid="map-container"]')
  const box = await mapEl.boundingBox()
  if (!box) throw new Error('Map container not found')
  // Click offset from any existing markers to avoid triggering the spot-panel
  await mapEl.click({ position: { x: box.width * 0.5, y: box.height * 0.3 } })
}

// ── FAB visibility ─────────────────────────────────────────────────────────────

baseTest('FAB add button is visible when logged out', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.goto('/map')
  await page.waitForLoadState('networkidle')

  await expect(page.locator('#add-btn')).toBeVisible()
  assertNoLeaks()
})

baseTest('FAB menu opens without login', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.goto('/map')
  await page.waitForLoadState('networkidle')

  await page.locator('#add-btn').click()
  await expect(page.locator('#fab-menu')).toBeVisible({ timeout: 4000 })
  assertNoLeaks()
})

// ── FAB menu toggle ────────────────────────────────────────────────────────────

baseTest('clicking the + button toggles the FAB menu', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.goto('/map')
  await page.waitForLoadState('networkidle')

  const menu = page.locator('#fab-menu')
  await expect(menu).toBeHidden()

  await page.locator('#add-btn').click()
  await expect(menu).toBeVisible()

  await page.locator('#add-btn').click()
  await expect(menu).toBeHidden()
  assertNoLeaks()
})

baseTest('FAB menu shows all three spot types', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.goto('/map')
  await page.waitForLoadState('networkidle')

  await page.locator('#add-btn').click()

  await expect(page.locator('.fab-item[data-type="trail"]')).toBeVisible()
  await expect(page.locator('.fab-item[data-type="bikepark"]')).toBeVisible()
  await expect(page.locator('.fab-item[data-type="dirtpark"]')).toBeVisible()
  assertNoLeaks()
})

// ── Add mode activation ────────────────────────────────────────────────────────

baseTest('selecting a type closes the FAB menu and activates add mode', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.goto('/map')
  await page.waitForLoadState('networkidle')

  await page.locator('#add-btn').click()
  await page.locator('.fab-item[data-type="trail"]').click()

  // Menu hides after type selection
  await expect(page.locator('#fab-menu')).toBeHidden()
  // Button turns active (green)
  await expect(page.locator('#add-btn')).toHaveClass(/active/)
  assertNoLeaks()
})

// ── Modal — opens after map click ─────────────────────────────────────────────

baseTest('clicking the map in add mode opens the add-spot modal', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  // No nearby trails so conflict check resolves immediately
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMap(page)

  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })
  assertNoLeaks()
})

baseTest('modal is pre-selected with the type that was chosen in the FAB', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'bikepark')
  await clickMap(page)

  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })
  // The bikepark radio input should be checked
  await expect(page.locator('[data-testid="add-spot-type-bikepark"]')).toBeChecked()
  assertNoLeaks()
})

// ── Modal — type-specific fields ──────────────────────────────────────────────

baseTest('dirtpark type shows pumptrack and dirtjump checkboxes', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'dirtpark')
  await clickMap(page)

  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })
  await expect(page.locator('[data-testid="add-spot-pumptrack"]')).toBeVisible()
  await expect(page.locator('[data-testid="add-spot-dirtpark-flag"]')).toBeVisible()
  assertNoLeaks()
})

baseTest('trail type does NOT show pumptrack or dirtjump checkboxes', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMap(page)

  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })
  await expect(page.locator('[data-testid="add-spot-pumptrack"]')).not.toBeVisible()
  await expect(page.locator('[data-testid="add-spot-dirtpark-flag"]')).not.toBeVisible()
  assertNoLeaks()
})

baseTest('switching type inside modal shows/hides dirtpark checkboxes', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMap(page)
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })

  // Switch to dirtpark
  await page.locator('[data-testid="add-spot-type-label-dirtpark"]').click()
  await expect(page.locator('[data-testid="add-spot-pumptrack"]')).toBeVisible()

  // Switch back to trail
  await page.locator('[data-testid="add-spot-type-label-trail"]').click()
  await expect(page.locator('[data-testid="add-spot-pumptrack"]')).not.toBeVisible()
  assertNoLeaks()
})

// ── Modal — validation ─────────────────────────────────────────────────────────

baseTest('submitting with an empty name shows an inline error, not an alert', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.route('**/functions/v1/add-trail', (route) => route.fulfill({ json: CREATED_TRAIL }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMap(page)
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })

  // Leave name empty and click submit
  await page.locator('[data-testid="add-spot-submit"]').click()

  // Inline error appears
  await expect(page.locator('[data-testid="add-spot-name-error"]')).toBeVisible()
  await expect(page.locator('[data-testid="add-spot-name-error"]')).toContainText('Namen ein')
  // Modal stays open
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible()
  assertNoLeaks()
})

// ── Modal — submission ─────────────────────────────────────────────────────────

baseTest('successful submit shows a success message', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.route('**/functions/v1/add-trail', (route) => route.fulfill({ json: CREATED_TRAIL }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMap(page)
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })

  await page.locator('[data-testid="add-spot-name"]').fill('Flowtrail Test')
  await page.locator('[data-testid="add-spot-submit"]').click()

  await expect(page.locator('[data-testid="add-spot-success"]')).toBeVisible({ timeout: 6000 })
  await expect(page.locator('[data-testid="add-spot-success"]')).toContainText('Prüfung')
  assertNoLeaks()
})

baseTest('server error shows an error message in the modal', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.route('**/functions/v1/add-trail', (route) =>
    route.fulfill({ status: 500, body: 'Internal Server Error' }),
  )
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMap(page)
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })

  await page.locator('[data-testid="add-spot-name"]').fill('Flowtrail Test')
  await page.locator('[data-testid="add-spot-submit"]').click()

  await expect(page.locator('[data-testid="add-spot-error"]')).toBeVisible({ timeout: 6000 })
  // Modal stays open so the user can correct and retry
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible()
  assertNoLeaks()
})

baseTest('submit button is disabled while the request is in flight', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  // Delay the response to catch the loading state
  await page.route('**/functions/v1/add-trail', async (route) => {
    await new Promise((r) => setTimeout(r, 400))
    route.fulfill({ json: CREATED_TRAIL })
  })
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMap(page)
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })

  await page.locator('[data-testid="add-spot-name"]').fill('Flowtrail Test')
  await page.locator('[data-testid="add-spot-submit"]').click()

  // While request is in flight the button must be disabled
  await expect(page.locator('[data-testid="add-spot-submit"]')).toBeDisabled()
  assertNoLeaks()
})

// ── Modal — closing ────────────────────────────────────────────────────────────

baseTest('cancel button closes the modal', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMap(page)
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })

  await page.locator('.add-spot-btn-cancel').click()
  await expect(page.locator('[data-testid="add-spot-modal"]')).not.toBeVisible()
  assertNoLeaks()
})

baseTest('clicking the backdrop closes the modal', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMap(page)
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })

  await page.locator('[data-testid="add-spot-backdrop"]').click({ position: { x: 5, y: 5 } })
  await expect(page.locator('[data-testid="add-spot-modal"]')).not.toBeVisible()
  assertNoLeaks()
})

baseTest('pressing Escape closes the modal', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMap(page)
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })

  await page.keyboard.press('Escape')
  await expect(page.locator('[data-testid="add-spot-modal"]')).not.toBeVisible()
  assertNoLeaks()
})

/** Clicks the map center pixel — used for nearby-conflict tests where coordinates matter. */
async function clickMapCenter(page: import('@playwright/test').Page) {
  const mapEl = page.locator('[data-testid="map-container"]')
  const box = await mapEl.boundingBox()
  if (!box) throw new Error('Map container not found')
  await mapEl.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } })
}

/**
 * Registers a nearby bikepark mock + clears other spot types so only the
 * bikepark can trigger the 5 km conflict check.
 *
 * The bikepark sits 4.4 km north of the map center (48.1, 11.5). Clicking the
 * map center (lat ≈ 48.1) puts the click within 5 km → triggers the dialog.
 */
async function setupNearbyBikeparkMock(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/trails**',     (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/dirt_parks**', (route) => route.fulfill({ json: [] }))
  await page.route('**/rest/v1/parks**', (route) => route.fulfill({
    json: [{ id: 'b-nearby', name: 'Bikepark Zentrum', type: 'bikepark',
             latitude: 48.14, longitude: 11.5,
             approved: true, creator: '', url: '', instagram: '', spotcheck: '', created_at: '2024-01-01' }],
  }))
}

// ── Nearby conflict ────────────────────────────────────────────────────────────

baseTest('clicking near an existing spot shows the nearby conflict dialog', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await setupNearbyBikeparkMock(page)
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMapCenter(page)

  await expect(page.locator('.nearby-box')).toBeVisible({ timeout: 6000 })
  await expect(page.locator('.nearby-box')).toContainText('Bikepark Zentrum')
  assertNoLeaks()
})

baseTest('confirming the nearby conflict opens the add-spot modal', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await setupNearbyBikeparkMock(page)
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMapCenter(page)
  await expect(page.locator('.nearby-box')).toBeVisible({ timeout: 6000 })

  // Click "Trotzdem" (proceed anyway)
  await page.locator('.nearby-actions .primary').click()
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })
  assertNoLeaks()
})

baseTest('cancelling the nearby conflict does not open the modal', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await setupNearbyBikeparkMock(page)
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMapCenter(page)
  await expect(page.locator('.nearby-box')).toBeVisible({ timeout: 6000 })

  // Click "Abbrechen" (cancel)
  await page.locator('.nearby-actions button:not(.primary)').click()
  await expect(page.locator('[data-testid="add-spot-modal"]')).not.toBeVisible()
  assertNoLeaks()
})

// ── Creator field ─────────────────────────────────────────────────────────────

baseTest('creator field is pre-filled and read-only when logged in', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  await enterAddMode(page, 'trail')
  await clickMap(page)
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })

  const creatorInput = page.locator('[data-testid="add-spot-creator"]')
  // Pre-filled with the mock user's nickname
  await expect(creatorInput).toHaveValue('TestRider')
  // Read-only so the user cannot type in it
  await expect(creatorInput).toHaveAttribute('readonly', '')
  assertNoLeaks()
})

baseTest('anonymous user can reach the add-spot modal', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')

  await page.locator('#add-btn').click()
  await page.locator('.fab-item[data-type="trail"]').click()
  await clickMap(page)

  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })
  // Creator field is editable (not pre-filled and not read-only)
  const creatorInput = page.locator('[data-testid="add-spot-creator"]')
  await expect(creatorInput).toHaveValue('')
  await expect(creatorInput).not.toHaveAttribute('readonly')
  assertNoLeaks()
})

// ── Reopen / reset ─────────────────────────────────────────────────────────────

baseTest('reopening the modal resets the form fields', async ({ page }) => {
  const assertNoLeaks = await setupAllMocks(page)
  await page.route('**/rest/v1/trails**', (route) => route.fulfill({ json: [] }))
  await page.goto('/map')
  await page.waitForLoadState('networkidle')
  await signInOnMapPage(page)

  // First open: fill in a name
  await enterAddMode(page, 'trail')
  await clickMap(page)
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })
  await page.locator('[data-testid="add-spot-name"]').fill('Old Name')
  await page.locator('.add-spot-btn-cancel').click()

  // Second open: name should be cleared
  await enterAddMode(page, 'trail')
  await clickMap(page)
  await expect(page.locator('[data-testid="add-spot-modal"]')).toBeVisible({ timeout: 6000 })
  await expect(page.locator('[data-testid="add-spot-name"]')).toHaveValue('')
  assertNoLeaks()
})
