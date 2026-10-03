# Creem billing (Supporter) — implementation plan

Spec: `docs/superpowers/specs/2026-10-03-creem-billing-design.md`
Repos: **F** = this worktree (`worktree-feat-creem-billing`), **B** = `../trailradar-backend` (own worktree under `../trailradar-backend-worktrees/feat-creem-billing`, branch `feat/creem-billing`).

Ground rules:

- Never commit to `main` in either repo. Commit at every checkpoint (✔).
- Test first for every behaviour (CLAUDE.md): the test must fail before the code exists.
- Tests never touch production: placeholder `SUPABASE_URL=http://localhost:54321`, Creem/Resend/Telegram mocked at the `fetch` boundary.
- **[user]** = a step only the user can do (dashboards, secrets, applying migrations). **[confirm]** = stop and ask before continuing.
- Nothing is user-visible until phase 4: the profile `PlanCard` is the only entry point to `/supporter`, and the locked Trail-Zustand teaser is **not** touched.

## Resolved against the code

- **No account-deletion UI exists** in `profile.vue` → the spec's "block deletion while subscribed" has nothing to attach to. Dropped; revisit when deletion is built.
- **The map uses `layout: 'map'` without `AppFooter`.** The §312k link therefore goes into `AppFooter` (all content pages) **and** the profile `PlanCard` **and** a FAQ entry. The map itself stays clean.
- **Subscription schema lives in F's `supabase/migrations/`** (entitlements migration is there), so the billing migration goes there too, not into B's migrations folder.
- **`/support` already exists** (community + PayPal). Leave it; add one line linking to `/supporter` only at go-live (phase 6), not now.
- **Admin check in the edge function**: call `get_my_role()` as the caller (user-JWT client), same as the frontend.
- **Native detection**: `Capacitor.isNativePlatform()` is already used in `auth.ts`/`auth.client.ts`; the new composable wraps it.

---

# Phase 0 — Prerequisites [user] (can run in parallel with phases 1–3)

- [ ] **[user]** Creem **test** dashboard: create products "TrailRadar Supporter monatlich" and "… jährlich" (recurring). Note both product ids.
- [ ] **[user]** Creem test dashboard: webhook → `https://ixafegmxkadbzhxmepsd.supabase.co/functions/v1/creem-webhook`; note the webhook secret and the test API key.
- [ ] **[user]** Resend: add + verify `trailradar.org` (SPF/DKIM DNS records), create API key, choose sender (e.g. `abo@trailradar.org`).
- [ ] **[user]** Decide prices (monthly / yearly, EUR, gross). **[confirm]** before F1 is applied.

# Phase 1 — Database (F)

## F1. Migration `supabase/migrations/20261003120000_add_creem_billing.sql`

Write the structural test first: `app/entitlements/billingMigration.test.ts` (same style as `signupGrantMigration.test.ts` — reads the SQL file, asserts on its text). It must fail (file missing). Assertions:

- [ ] `subscriptions` gets `provider_customer_id`, `customer_email`, `provider_updated_at`.
- [ ] Partial unique index on `(provider, provider_subscription_id)`.
- [ ] `one_active_subscription_per_user` is dropped and recreated including `'past_due'`.
- [ ] `get_my_entitlement` is replaced and its `active_sub` filter includes `'past_due'`; still `SECURITY DEFINER` + `SET search_path TO ''`.
- [ ] `billing_events` and `cancel_requests` exist with RLS enabled and **no** `CREATE POLICY` for them.
- [ ] `can_start_checkout(uuid)` exists (SECURITY DEFINER, pinned search_path), uses `interval '14 days'`, returns the three reasons; `EXECUTE` revoked from `anon`/`authenticated` (service role only).
- [ ] `get_my_checkout_eligibility()` exists, calls `can_start_checkout(auth.uid())`, granted to `authenticated`.
- [ ] Seed: `UPDATE subscription_plans SET price_monthly_cents…, price_yearly_cents… WHERE id = 'plus'`; `plan_provider_prices` inserts for `creem_test` monthly/yearly. Live (`creem`) rows are **not** in this migration — they come with go-live (phase 6) as a separate migration.

Then write the SQL per spec §1, prices + test product ids filled from phase 0.

- [ ] `npm test` green. ✔ commit "feat(db): creem billing migration".
- [ ] **[user]** Apply the migration (SQL editor / `supabase db push`, as for the previous ones). Then **[user]** regenerate `app/types/database.types.ts`.
- [ ] Sanity check after apply **[user]**, in the SQL editor: `select * from can_start_checkout('<own uid>')` → `grant_active` with an `eligible_from` date for an account that has a grant.

# Phase 2 — Backend shared code (B)

## B0. Worktree

- [ ] `git -C ../trailradar-backend worktree add ../trailradar-backend-worktrees/feat-creem-billing -b feat/creem-billing`. All B work happens there.

## B1. `_shared/creem.ts` (test first: `_shared/creem.test.ts`)

- [ ] `verifySignature(rawBody, signatureHeader, secret): Promise<boolean>` — HMAC-SHA256 hex via WebCrypto, constant-time compare. Tests: valid fixture signature → true; one flipped byte in body → false; missing header → false; wrong secret → false.
- [ ] `creemClient({ apiKey, mode, fetchFn })` with `createCheckout`, `cancelScheduled(subId)`, `resume(subId)`, `portalLink(customerId)`. Base URL by mode (`https://api.creem.io/v1` / `https://test-api.creem.io/v1`), header `x-api-key`. Tests with a fake `fetchFn`: correct URL per mode, method, headers and body for each call; non-2xx → throws `CreemError` with status.
- [ ] **[confirm]** Before writing the request bodies, read the Creem API reference pages for create-checkout, cancel (exact param for "scheduled" / at period end), resume, and `customers/billing`. Pin the exact field names in a comment at the top of the file with the doc URL. The spec only fixed behaviour, not wire names.

## B2. `_shared/email.ts` (test first)

- [ ] `sendEmail({ to, subject, text, html }, env, fetchFn)` → Resend `POST https://api.resend.com/emails`. Missing `RESEND_API_KEY` → log + skip (like `telegram.ts`), so local dev works. Tests: request shape; skip without key; non-2xx throws.
- [ ] `cancelConfirmationEmail({ contract, receivedAt, endsAt })` → `{ subject, text, html }`, German copy; dates formatted `de-DE`, `Europe/Berlin`. Test: contains contract name, receipt timestamp, end date.

✔ commit in B "feat: shared creem client and email helper".

# Phase 3 — Edge functions (B), test first

## B3. `creem-webhook`

Files: `supabase/functions/creem-webhook/{index.ts,handler.ts,mapping.ts,handler.test.ts,mapping.test.ts,deno.json}`. No `cors.ts` (server-to-server). Add `[functions.creem-webhook] verify_jwt = false` to `supabase/config.toml`.

`mapping.ts` — pure: `mapCreemStatus(eventType, status) → { status, cancelAtPeriodEnd? } | null`. Table test for every row in spec §2.5, plus unknown status → `null`.

`handler(req, deps)`, deps: `secrets: { live, test }`, `events: { insert(id, provider, type, payload) → 'new'|'duplicate'|'unprocessed', markProcessed(id), markError(id, msg) }`, `subs: { findByProviderId(provider, subId), upsert(row) }`, `users: { idByEmail(email) }`, `notify(text)`, `now`.

Tests (each red first):
- [ ] Non-POST → 405. Bad / missing signature → 401, nothing stored.
- [ ] Signed with test secret → row written with `provider = 'creem_test'`; live secret → `'creem'`.
- [ ] Same event id twice → second call 200, `upsert` called once.
- [ ] Event id stored earlier but `processed_at` null (crashed run) → processed again.
- [ ] `subscription.active` with `metadata.user_id` → upsert with `status active`, `plan_id 'plus'`, `current_period_end`, `provider_customer_id`, `customer_email`, `provider_updated_at`.
- [ ] `subscription.scheduled_cancel` → `active` + `cancel_at_period_end = true`.
- [ ] `subscription.past_due` → `past_due`; `subscription.expired` → `expired`; `subscription.canceled` → `canceled`.
- [ ] Older event (created_at < stored `provider_updated_at`) → no upsert, still 200 + processed.
- [ ] Missing `metadata.user_id`, `customer.email` matches an account → that user id used.
- [ ] No user resolvable → `markError`, `notify` alert, 200 (no retry loop).
- [ ] `refund.created` / `dispute.created` → `notify` only, no upsert.
- [ ] Upsert throws → `markError`, **500**.
- [ ] Notify text: new subscriber / scheduled cancel / expiry; test-mode prefixed `[TEST]`. `notify` failure never changes the response.

`index.ts`: service-role client; `users.idByEmail` via `auth.admin` lookup (or a SECURITY DEFINER SQL helper if the admin API has no by-email lookup — **[confirm]** which, since it may need a tiny extra migration in F).

✔ commit in B "feat: creem-webhook function".

## B4. `billing`

Files: `supabase/functions/billing/{index.ts,handler.ts,handler.test.ts,cors.ts,deno.json}`. `cors.ts` copied from `soil-report` (localhost + Capacitor origins included).

Deps: `getUser(jwt)`, `isAdmin(jwt)`, `eligibility(uid)`, `productId(provider, interval)`, `liveSubscription(uid)`, `subscriptionByEmail(email)`, `latestCustomer(uid)`, `setCancelFlag(subId, bool)`, `cancelRequests: { countRecent(email, ipHash), insert(row) }`, `creem(mode)`, `sendEmail`, `notify`, `siteUrl`, `now`.

Tests (each red first):
- [ ] `OPTIONS` → 200 + CORS. Non-POST → 405. Unknown `action` → 400.
- [ ] **checkout**: no JWT → 401; `interval` invalid → 400; `already_subscribed` → 409; `grant_active` → 409 with `eligibleFrom`; eligible → Creem called with product id for `(creem, interval)`, `metadata.user_id`, account email, `success_url = ${siteUrl}/supporter/danke`, a uuid `request_id` → 200 `{ checkoutUrl }`.
- [ ] checkout `mode:'test'` as admin → `creem_test` product + test client; as non-admin → silently live.
- [ ] Creem throws → 502 `provider_error`.
- [ ] **portal**: no JWT → 401; no customer → 404 `no_customer`; else 200 `{ url }` using the subscription's provider (test customer → test client).
- [ ] **cancel with JWT**: live sub → `cancelScheduled`, flag set, `cancel_requests` row with `user_id` + `subscription_id`, email sent, notify → 200 `{ ok, receivedAt }`.
- [ ] cancel already scheduled → no Creem call, email re-sent, 200.
- [ ] **cancel without JWT**, matching email (case-insensitive, trimmed) → same as above.
- [ ] cancel without JWT, **no match** → response body identical in shape and status to the match case; row stored with `subscription_id null`; **no** email, **no** Creem call.
- [ ] cancel without JWT and without email → 400.
- [ ] rate limit: 4th request for the same email within an hour → 429; 21st global within a minute → 429.
- [ ] **resume**: no JWT → 401; nothing scheduled → 409; scheduled → Creem resume, flag reset, 200.

✔ commit in B "feat: billing function".

## B5. Docs + deploy prep (B)

- [ ] `CLAUDE.md`: add `billing` and `creem-webhook` to the function list + a short paragraph each (like `soil-report`), list the secrets from spec §2.2.
- [ ] `deno task test` green. ✔ commit.
- [ ] **[user]** `supabase secrets set CREEM_TEST_API_KEY=… CREEM_TEST_WEBHOOK_SECRET=… RESEND_API_KEY=… BILLING_FROM_EMAIL=… SITE_URL=https://trailradar.org` (live Creem secrets come at go-live).
- [ ] **[user]** `supabase functions deploy creem-webhook --no-verify-jwt` and `supabase functions deploy billing`.
- [ ] **[user]** Creem test dashboard → send a test webhook → `billing_events` has a row with `processed_at` set.

# Phase 4 — Frontend data layer (F), test first

## F2. `app/communication/billing.ts` (+ `billing.test.ts`)

Mock `fetch`; assert URL (`FUNCTIONS/billing`, `REST/...`), headers (`userHeaders` / `anonHeaders`), body; and the result mapping:

- [ ] `startCheckout(jwt, interval, mode?)` → `ok/checkoutUrl`, `already_subscribed`, `grant_active{eligibleFrom}`, network error → `unknown`.
- [ ] `openPortal(jwt)`, `resumeSubscription(jwt)` → ok / typed error.
- [ ] `cancelSubscription({ jwt })` and `cancelSubscription({ email, name })` (anon headers) → `ok/receivedAt`, 429 → `rate_limited`.
- [ ] `getMySubscription(jwt)` → REST `subscriptions?status=in.(active,trialing,past_due)&order=created_at.desc&limit=1` → mapped `Subscription | null`.
- [ ] `getCheckoutEligibility(jwt)` → RPC `get_my_checkout_eligibility` → `{ eligible, reason, eligibleFrom }`; failure → `{ eligible: false, reason: 'unknown' }` (fail closed for UX).
- [ ] `getSupporterPrices()` → `subscription_plans?id=eq.plus` → `{ monthlyCents, yearlyCents, currency }`.
- [ ] Type `Subscription` in `app/types/Subscription.ts`.

## F3. `subscriptionStore` (+ extend `subscription.test.ts`)

- [ ] `subscription`, `eligibility` loaded in `load()` in parallel with the entitlement; logged out → both null.
- [ ] `canBuy`: logged in ∧ `eligibility.eligible` ∧ not native (native is passed in by the caller, not read in the store — keeps the store free of Capacitor). Matrix test.
- [ ] `isCancelScheduled`, `isPastDue` computeds.

## F4. `useIsNativeApp()` (+ test)

- [ ] `app/composables/useIsNativeApp.ts`: `false` on server and before mount, `Capacitor.isNativePlatform()` after mount (SSR-safe, like `useFeatureAccess`). Test with `@capacitor/core` mocked both ways.

✔ commit "feat: billing data layer".

# Phase 5 — Frontend UI (F), test first

Every new page: `← Zurück zur Karte` back link, mobile layout checked at 360 px, touch targets ≥ 44 px. Existing custom-CSS style; no component framework.

## F5. `PlanCard.vue` (`app/components/profile/`) + test

States (one test each): free without grant; grant running (>14 d: "Gratis bis X", no buy button); grant ≤14 d (buy link to `/supporter`); active ("verlängert sich am X"); cancel scheduled ("endet am X" + "Kündigung zurücknehmen"); past_due (warning + "Zahlungsmittel aktualisieren" → portal); native (no buy link, neutral text). Buttons call the store/communication functions; portal opens via `window.location.href` (web) or `@capacitor/browser` if already a dependency, else plain link — **[confirm]** in native.
- [ ] Mount in `profile.vue` as a new `profile-section` after the profile header.

## F6. `/supporter` (`app/pages/supporter/index.vue`) + test

- [ ] Prices: build-time `useAsyncData(getSupporterPrices)`, refreshed on mount.
- [ ] Monthly/yearly toggle; yearly shows the effective monthly price.
- [ ] CTA states per spec §3.4 (logged out → `mapStore.authModalOpen = true`; grant_active; eligible with grant → "Abrechnung startet sofort"; eligible; subscribed; native). One test per state.
- [ ] Withdrawal-notice line above the button (placeholder copy, marked for legal review).
- [ ] Click → `startCheckout` → `window.location.href = checkoutUrl`; errors shown inline. Admin-only small "Testmodus" checkbox → `mode:'test'`.
- [ ] Add `/supporter` to prerender routes if not crawled automatically (no inbound link from public pages yet!) — check `nuxt.config.ts` `nitro.prerender.routes`.

## F7. `/supporter/danke` + test (fake timers)

- [ ] On mount: logged out → login prompt, start polling after login. Logged in → `subscriptionStore.load()` every 2 s, max 15 tries.
- [ ] level ≥ 1 after try 3 → success view, polling stops. Never reaches → timeout copy, no error styling. URL query params ignored (test: success params in URL but level 0 → still polling).
- [ ] `<meta name="robots" content="noindex">`.

## F8. `/kuendigen` + test

- [ ] Logged in + live sub → contract, end date, "Jetzt kündigen" (one click, no extra confirm dialog).
- [ ] Logged in + scheduled → end date + "Kündigung zurücknehmen".
- [ ] Logged out / no sub → name + email form, "Jetzt kündigen"; email required, basic validation.
- [ ] Result view with `receivedAt` (`de-DE`), copy per spec; `rate_limited` → friendly retry message.
- [ ] Page title exactly "Verträge hier kündigen".

## F9. Links + legal copy

- [ ] `AppFooter.vue`: "Verträge hier kündigen" → `/kuendigen` (test: link present).
- [ ] FAQ entry "Wie kündige ich mein Supporter-Abo?" → `/kuendigen`.
- [ ] `terms.vue` / `privacy.vue`: draft Supporter + Creem (MoR) + Resend sections. Mark in the PR description as **needs legal review**. **[confirm]** the user wants the drafts in the pages now vs. in a doc first.

## F10. Architecture + full suite

- [ ] `app/architecture.test.ts`: confirm the no-hardcoded-URL rule covers `communication/billing.ts`; add a test that no file outside `communication/` calls `FUNCTIONS/billing` directly.
- [ ] `npm test`, `npm run lint:arch` green.
- [ ] Run the dev server (fresh worktree: `npx nuxt prepare` first; stop the primary checkout's :3000 server — see worktree traps memory) and click through `/supporter`, `/kuendigen`, profile at mobile width.

✔ commit per page (F5–F9), final ✔ "feat: supporter billing UI".

# Phase 6 — End-to-end in test mode, then go-live

## Test-mode run [user + Claude]
- [ ] Ship F (PR → user merges → deploy). Nothing links to `/supporter` publicly; reachable via profile.
- [ ] As admin (whose grant must be ≤14 d or removed for the test — **[user]** temporarily set `free_until` on the own grant row): `/supporter` → Testmodus → Creem test card → `/supporter/danke` shows success → profile shows "verlängert sich am …" → portal opens → cancel via `/kuendigen` → email arrives, profile shows "endet am …" → resume → cancel again → anonymous cancel with own email from a private window → no info leak, email arrives.
- [ ] Check `billing_events`: every event `processed_at` set, no `error`.
- [ ] Restore the own grant row.

## Go-live gate [user]
- [ ] Prices final; legal copy reviewed; Open-Meteo commercial licence active (`OPEN_METEO_API_KEY` set).
- [ ] Creem **live**: products, webhook (same URL), `CREEM_LIVE_API_KEY` + `CREEM_LIVE_WEBHOOK_SECRET` secrets.
- [ ] F migration `…_add_creem_live_prices.sql` with the live `plan_provider_prices` rows (Claude writes, user applies).
- [ ] Optional: one line on `/support` linking to `/supporter`. The locked teaser stays as is (spec decision).

## Follow-ups (not in this plan)
- Day −14 reminder banner/email.
- Account deletion flow must check for a live subscription.
- Admin subscriber overview.
