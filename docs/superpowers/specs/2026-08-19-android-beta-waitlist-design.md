# Android beta waitlist — design

## Purpose
Collect email + name signups from people who want early access to the Android
app (Capacitor build in `android/`), via a single link shareable on Instagram
stories. No banner/homepage integration yet — that's a later, separate task.

## Lifecycle: this is temporary
This feature exists to bridge the gap until the Android app has a public beta
channel (e.g. Play Store closed/open testing). Once the app rolls out and the
waitlist has served its purpose:
- Drop the `beta_signups` table (migration to remove it).
- Delete `src/pages/android-beta.vue` and `src/communication/betaSignup.ts`
  (+ their test).
- Remove the Instagram-story link.

The migration file and the page/communication files should each carry a short
comment noting this so a future cleanup pass finds them easily even without
this spec.

## Data layer
New table `beta_signups`:

| column | type | notes |
|---|---|---|
| `id` | bigint identity | PK |
| `created_at` | timestamptz | default `now()` |
| `name` | text | required |
| `email` | text | required, `UNIQUE` |

RLS: `INSERT` allowed for `anon`/`public`. No `SELECT`/`UPDATE`/`DELETE`
policy for anon — the list is only readable via the Supabase dashboard
(service role bypasses RLS), which is how the manual export → Resend
audience import will happen later.

Migration: `supabase/migrations/20260819120000_add_beta_signups.sql`,
following the style of `20260811120000_add_spot_comments.sql`.

## Communication layer
`src/communication/betaSignup.ts`:

```ts
export async function submitBetaSignup(name: string, email: string): Promise<void>
```

- Plain `POST` to `${REST}/beta_signups` with `anonHeaders()` — no edge
  function needed, this is a straight insert (matches the direct-REST
  pattern used elsewhere in `communication/`, e.g. `add_spot.ts`).
- On a `409` (unique violation on `email`), throw a distinguishable error
  (e.g. a typed error or a specific message) so the page can show "you're
  already on the list" instead of a generic failure.
- `betaSignup.test.ts` mocks `fetch` and covers: success, duplicate-email
  (409), generic error.

## Page
`src/pages/android-beta.vue` at `/android-beta`:
- Reuses the existing `PageHero` + `.container` layout pattern (see
  `support.vue`).
- German copy (matches site tone), short headline + 2-3 placeholder bullets
  about the beta — swappable later for real copy/screenshots.
- Form: name + email fields, submit button.
- States: idle → submitting → success ("Danke, du bist auf der Liste!") or
  inline error (duplicate vs. generic), all local `ref`s in the component —
  no store needed for a one-off form with no shared/cross-component state.
- No auth required.

## Out of scope (explicitly, for now)
- Resend API integration — signups stay in Supabase; you'll export and
  import into a Resend audience by hand when ready.
- Banner/homepage placement — link will be shared directly for the
  Instagram story.
- iOS — table/page are Android-specific for now; no `platform` column.

## Testing
- `betaSignup.test.ts` (vitest, mocked fetch) — success, duplicate, error.
- No E2E needed; this is a simple form, not part of the map/auth/add-spot
  flows the Playwright suite covers.
