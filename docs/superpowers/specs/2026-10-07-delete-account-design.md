# Delete account — design

Status: approved 2026-10-07, implementing.

## Goal
A logged-in user can delete their TrailRadar account themselves from `/profile` (GDPR Art. 17, App Store requirement for in-app deletion).

## Decisions
- **Content stays, anonymized.** Photos and comments are kept and shown as "Gelöschter Nutzer". Created spots already survive (`creator_id ON DELETE SET NULL`). Photo files in Storage stay.
- **Paid subscription blocks deletion.** A subscription with `status IN (active, trialing, past_due)`, `provider <> 'manual'` and `cancel_at_period_end = false` blocks. The user is sent to `/kuendigen` first. Already-cancelled-at-period-end subscriptions don't block (no further charge).
- **Admins can't delete themselves** (403) — avoids locking the project out; admins are removed by hand in the DB. Trailcrew can (`trailcrew_spots` cascades).
- **Immediate deletion, typed confirmation** (`LÖSCHEN`), no grace period. Works for password-less users too.
- Telegram ping on every deletion.

## Pieces

### 1. Migration (`supabase/migrations/20261007120000_account_deletion.sql`)
- `trail_photos.creator` → `ON DELETE SET NULL` (currently NO ACTION, blocks deletion).
- `spot_comments.user_id` → drop `NOT NULL`; both FKs (`auth.users`, `profiles`) → `ON DELETE SET NULL`.

Everything else already cascades (profiles, favorites, user_roles, trailcrew_spots, subscriptions, early_adopter_grants).

### 2. Edge function `delete-account` (`trailradar-backend`)
`POST`, user JWT. `handler.ts` pure with injected deps, `index.ts` wires them.

| Case | Response |
|---|---|
| no/invalid JWT | 401 `{ error: 'unauthorized' }` |
| caller is admin (`get_my_role`) | 403 `{ error: 'admin' }` |
| blocking paid subscription | 409 `{ error: 'active_subscription' }` |
| `auth.admin.deleteUser` fails | 500 `{ error: 'delete_failed' }` |
| success | 200 `{ ok: true }` + Telegram ping |

CORS: `https://trailradar.org`, localhost dev origins, Capacitor (`https://localhost`, `capacitor://localhost`).

### 3. Client
- `app/communication/account.ts` — `deleteAccount(jwt)` → `{ ok: true } | { ok: false, error: 'active_subscription' | 'admin' | 'unknown' }` (values, not throws; same style as `billing.ts`).
- `app/utils/authorName.ts` — `authorName(profiles, fallback)`: `null` profiles → "Gelöschter Nutzer", else `display_name || fallback`. Used by `SpotPanelComments.vue` and `SpotDetailPhotos.vue`.
- `app/components/profile/DeleteAccountSection.vue` — last section on `/profile`. Loads `getMySubscription()`; if blocking, button disabled + link to `/kuendigen`. Admins see a hint instead of the button. Button opens a confirm modal; typing `LÖSCHEN` enables "Endgültig löschen". On success: `authStore.signOut()`, toast, navigate to `/map`. Errors map to German messages.
- `privacy.vue` — mention self-service deletion.

### 4. Tests
- `account.test.ts` — request shape + 200/409/403/500/network mapping.
- `authorName.test.ts`, plus component tests: a comment/photo with `profiles: null` renders "Gelöschter Nutzer" (fails before the fix).
- `DeleteAccountSection.test.ts` — typed-confirm gating, subscription block, admin hint, success → signOut + navigate, error message.
- Backend `handler.test.ts` — 401/403/409/500/200, cancelled-at-period-end and manual grants don't block.
