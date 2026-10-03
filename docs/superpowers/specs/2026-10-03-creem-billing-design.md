# Creem Billing — Supporter Subscription

**Date:** 2026-10-03
**Status:** Draft (design approved in brainstorming, awaiting spec review)
**Builds on:** `2026-09-23-subscription-entitlements-design.md` (schema, `get_my_entitlement`, `has_min_tier`, `useFeatureAccess`)

## Summary

Let users buy the **Supporter** plan (level 1, plan id `plus`) monthly or yearly through
**Creem.io** (Merchant of Record), see which plan they are on, cancel it (incl. a
§312k BGB "Verträge hier kündigen" flow), undo a scheduled cancellation, and manage
invoices/payment method in Creem's hosted customer portal.

Spans two repos: Postgres migration + Nuxt UI here, two Deno edge functions in
`../trailradar-backend`.

## Decisions

| Topic | Decision |
|---|---|
| What is sold | Supporter only, monthly + yearly. No Pro, no upgrade/downgrade. |
| Where it can be bought | Web + installed PWA only. Capacitor native shells (iOS + Android) show a neutral text line, no link, no price. |
| Early-adopter grant holders | Cannot buy while the grant has **more than 14 days** left. In the last 14 days (and after expiry) they can; billing starts immediately, communicated as such. |
| Cancellation | Own `/kuendigen` page (logged-in one-click, or name + email without login) + Creem customer portal for invoices / payment method. Always **at period end**; resumable until then. |
| Confirmation email | Resend, from the backend. |
| Test vs. live | Single prod Supabase project. `provider = 'creem_test'` vs `'creem'`. Only admins can start a test checkout; test subscriptions grant access like live ones. |
| Failed payment | `past_due` keeps access (grace) until Creem gives up (`unpaid` / `expired`). |
| Locked Trail-Zustand teaser | **Unchanged** — stays a signup link. Nothing links to `/supporter` from the teaser; the product is meant to stay free for now. |
| Refund / dispute | Logged + Telegram ping only. Access follows the subscription events Creem sends. |

## Out of scope

- Day −14 reminder (banner or email) for grant holders.
- Pro plan, upgrades/downgrades, plan switching in the portal.
- In-app purchases (Apple / Google / RevenueCat).
- Account deletion while a subscription is live — profile shows "Bitte erst kündigen" and blocks deletion.
- Admin revenue / subscriber UI.
- Automatic revoke on refund/dispute.

---

## 1. Data model (migration in this repo)

`supabase/migrations/<ts>_add_creem_billing.sql`:

### 1.1 `subscriptions` additions
```sql
ALTER TABLE public.subscriptions
  ADD COLUMN provider_customer_id text,      -- Creem customer id, needed for the portal link
  ADD COLUMN customer_email      text,       -- email used at Creem; may differ from the account email
  ADD COLUMN provider_updated_at timestamptz; -- event time of the last applied event; guards out-of-order delivery

CREATE UNIQUE INDEX subscriptions_provider_sub_id
  ON public.subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
```

### 1.2 `past_due` counts as live
- `one_active_subscription_per_user`: recreate with `WHERE status IN ('active','trialing','past_due')`.
- `get_my_entitlement()`: `active_sub` CTE accepts `status IN ('active','trialing','past_due')`.

### 1.3 `billing_events`
```sql
CREATE TABLE public.billing_events (
  id           text PRIMARY KEY,   -- Creem event id → idempotency
  provider     text NOT NULL,      -- 'creem' | 'creem_test'
  type         text NOT NULL,
  payload      jsonb NOT NULL,
  received_at  timestamptz DEFAULT now(),
  processed_at timestamptz,
  error        text
);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
```

### 1.4 `cancel_requests`
Every cancellation declaration, logged-in or not — serves as the record of receipt
(§312k requires confirming *receipt* incl. timestamp) and as the rate-limit source.
```sql
CREATE TABLE public.cancel_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz DEFAULT now(),
  user_id         uuid,           -- set when the caller had a JWT
  email           text NOT NULL,  -- normalised lower-case
  name            text,
  subscription_id uuid REFERENCES public.subscriptions(id),  -- null when nothing matched
  ip_hash         text            -- sha256(ip + daily salt), for rate limiting only
);
ALTER TABLE public.cancel_requests ENABLE ROW LEVEL SECURITY;  -- no policies: service role only
```
Rate limit (enforced in the edge function by counting rows): max 3 per email per hour,
max 20 globally per minute → 429.

### 1.5 `can_start_checkout(uid uuid)`
SECURITY DEFINER, `search_path = ''`, returns `(eligible boolean, reason text, eligible_from timestamptz)`:
- live subscription (`active` / `trialing` / `past_due`) → `(false, 'already_subscribed', null)`
- early-adopter grant with `free_until > now() + interval '14 days'` → `(false, 'grant_active', free_until - interval '14 days')`
- otherwise `(true, null, null)`

Callable by the service role (edge function) and by `authenticated` for its own uid only
(`get_my_checkout_eligibility()` wrapper using `auth.uid()`), so client UX and server
enforcement read one rule.

### 1.6 Seed data
- `subscription_plans` row `plus`: set `price_monthly_cents`, `price_yearly_cents` (values
  supplied by the user before apply; migration carries clearly marked placeholders).
- `plan_provider_prices`: four rows `plus × {creem, creem_test} × {monthly, yearly}` with
  Creem product ids (filled in after the products exist in both Creem dashboards).

After applying: regenerate `app/types/database.types.ts`.

---

## 2. Backend (`../trailradar-backend`)

Pattern as `trail-condition`: `handler.ts` = pure function of injected deps
(`creem`, `db`, `mail`, `telegram`, `now`), `index.ts` wires the real ones, `cors.ts`
allows `https://trailradar.org` + localhost dev origins.

### 2.1 Shared
- `_shared/creem.ts` — tiny client: `createCheckout`, `cancelSubscription(id, 'scheduled')`,
  `resumeSubscription(id)`, `customerPortalLink(customerId)`; base URL
  `https://api.creem.io/v1` or `https://test-api.creem.io/v1`, header `x-api-key`.
  `verifySignature(rawBody, header, secret)` — HMAC-SHA256, constant-time compare.
- `_shared/email.ts` — Resend `send({ to, subject, text, html })`.

### 2.2 Secrets
`CREEM_LIVE_API_KEY`, `CREEM_LIVE_WEBHOOK_SECRET`, `CREEM_TEST_API_KEY`,
`CREEM_TEST_WEBHOOK_SECRET`, `RESEND_API_KEY`, `BILLING_FROM_EMAIL`,
`SITE_URL` (for success URLs; localhost when serving locally).

### 2.3 `billing` function — POST `{ action, ... }`

**`checkout { interval: 'monthly'|'yearly', mode?: 'test' }`**
1. JWT required → user (401 otherwise).
2. `mode: 'test'` honoured only if the caller is admin (`get_my_role()`); otherwise live.
3. `can_start_checkout(uid)` → 409 `{ error: 'already_subscribed' }` or
   409 `{ error: 'grant_active', eligibleFrom }`.
4. Product id from `plan_provider_prices (plus, provider, interval)`.
5. Creem create checkout: `product_id`, `request_id` (uuid), `metadata.user_id`,
   customer email = account email, `success_url = ${SITE_URL}/supporter/danke`.
6. → `200 { checkoutUrl }`.

**`portal`** — JWT → user's newest subscription with a `provider_customer_id` →
Creem `POST /customers/billing` → `200 { url }`; none → 404 `{ error: 'no_customer' }`.

**`cancel { email?, name? }`**
- With JWT: target = user's live subscription; email = account email.
- Without JWT: `email` required; target = live subscription whose `customer_email` or
  owning account email equals it (case-insensitive).
- Rate limit (§1.4) → 429.
- Insert `cancel_requests` row (always, match or not).
- On match and not already `cancel_at_period_end`: Creem cancel `scheduled`, set
  `cancel_at_period_end = true` locally, send confirmation email (contract "TrailRadar
  Supporter (monatlich|jährlich)", received-at timestamp, end date), Telegram ping.
- Already scheduled: re-send the confirmation email only.
- **Response is always `200 { ok: true, receivedAt }`** regardless of match, so the
  endpoint cannot be used to probe which emails have subscriptions.

**`resume`** — JWT → live subscription with `cancel_at_period_end` → Creem resume →
flag reset locally → `200 { ok: true }`; nothing to resume → 409.

Creem API failures → 502 `{ error: 'provider_error' }`, logged.

### 2.4 `creem-webhook` function (deployed `--no-verify-jwt`)
1. Read raw body. Verify `creem-signature` with the live secret, then the test secret.
   Match decides `provider = 'creem' | 'creem_test'`. Neither → 401.
2. `INSERT INTO billing_events … ON CONFLICT (id) DO NOTHING`; if the row already has
   `processed_at` → 200 (duplicate delivery).
3. Dispatch:
   - `checkout.completed`, `subscription.*` → upsert `subscriptions` on
     `(provider, provider_subscription_id)`:
     - `user_id` from `metadata.user_id`; fallback: account whose email = `customer.email`;
       neither → record `error`, Telegram alert, return 200 (manual fix, no retry loop).
     - skip the write if the event time < row's `provider_updated_at`.
     - status mapping (below), `current_period_end`, `provider_customer_id`,
       `customer_email`, `plan_id = 'plus'`, `provider_updated_at = event time`.
   - `refund.created`, `dispute.created` → Telegram ping only.
   - anything else → stored, no-op.
4. Set `processed_at` → 200. Any exception → store in `error`, return 500 (Creem retries:
   30 s, 5 min, 30 min, 6 h).
5. Telegram ping on: new active subscription, scheduled cancel, expiry, refund, dispute.
   Test-mode pings prefixed `[TEST]`.

### 2.5 Status mapping

| Creem event / status | `status` | `cancel_at_period_end` | Access |
|---|---|---|---|
| `active`, `subscription.paid` | `active` | `false` | yes |
| `scheduled_cancel` | `active` | `true` | yes, until `current_period_end` |
| `past_due` | `past_due` | unchanged | yes (grace) |
| `trialing` | `trialing` | unchanged | yes (not used, harmless) |
| `unpaid`, `expired` | `expired` | `false` | no |
| `canceled`, `paused` | `canceled` | `false` | no |

### 2.6 Backend docs
Update `trailradar-backend/CLAUDE.md` function list + a short section for `billing` and
`creem-webhook`.

---

## 3. Frontend (this repo)

### 3.1 Communication — `app/communication/billing.ts`
Uses `FUNCTIONS`, `REST`, `userHeaders()`, `anonHeaders()` from `http.ts`. Typed results,
no throws for expected outcomes:
- `startCheckout(jwt, interval)` → `{ ok: true, checkoutUrl } | { ok: false, error: 'already_subscribed' } | { ok: false, error: 'grant_active', eligibleFrom } | { ok: false, error: 'unknown' }`
- `openPortal(jwt)` → `{ ok: true, url } | { ok: false, error }`
- `cancelSubscription({ jwt } | { email, name })` → `{ ok: true, receivedAt } | { ok: false, error: 'rate_limited' | 'unknown' }`
- `resumeSubscription(jwt)`
- `getMySubscription(jwt)` → newest live-or-scheduled `subscriptions` row (RLS: own rows) or `null`
- `getCheckoutEligibility(jwt)` → RPC `get_my_checkout_eligibility`
- `getSupporterPrices()` → `subscription_plans` row `plus` (anon read)

### 3.2 Store — `subscriptionStore` additions
- `subscription: Subscription | null`, `eligibility`, loaded alongside the entitlement.
- `canBuy` computed (UX only; server decides).
- `load()` stays the single refresh entry point (used by the thank-you page polling).

### 3.3 `useIsNativeApp()` composable
`Capacitor.isNativePlatform()`, false during SSR. Native → every buy CTA is replaced by
"Supporter kannst du auf trailradar.org abschließen." (no link, no price). Plan status,
cancel, resume and portal stay available in native.

### 3.4 Pages
All new pages carry `<NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>`.

- **`/supporter`** — prerendered; benefits (Trail-Zustand, supporting the project),
  monthly/yearly toggle, prices (build-time + client refresh). CTA by state:
  - logged out → "Registrieren" (opens auth modal; signup grants the free 6 months)
  - `grant_active` → "Du hast Trail-Zustand noch gratis bis {date}. Ab {eligibleFrom} kannst du hier Supporter werden."
  - eligible with a grant still running → "Supporter werden — Abrechnung startet sofort"
  - eligible → "Supporter werden"
  - subscribed → "Du bist Supporter ❤️" + link to profile
  - native → neutral text (3.3)
  - Before redirecting: checkbox/line for the digital-content withdrawal notice (wording per legal review, see §4).
- **`/supporter/danke`** — calls `subscriptionStore.load()` every 2 s for up to 30 s.
  Level ≥ 1 → "Danke! Trail-Zustand ist freigeschaltet." + "Zur Karte". Timeout →
  "Zahlung eingegangen — die Freischaltung dauert noch einen Moment." (no error state).
  Never trusts URL params. Logged-out arrival → login prompt, then same polling.
- **`/kuendigen`** — §312k page.
  - Logged in with a live subscription: shows contract + end date, "Jetzt kündigen".
  - Logged in, already scheduled: shows end date + "Kündigung zurücknehmen".
  - Otherwise: name + email form, "Jetzt kündigen".
  - After submit: confirmation view with `receivedAt` and "Bestätigung per E-Mail ist unterwegs (falls zu dieser Adresse ein Abo besteht)."

### 3.5 Components
- **`PlanCard.vue`** in `profile.vue`: plan name; status line
  ("verlängert sich am X" / "endet am X" / "Zahlung fehlgeschlagen — bitte Zahlungsmittel aktualisieren" / "Gratis bis X");
  buttons "Abo verwalten" (portal), "Kündigen" (→ `/kuendigen`), "Kündigung zurücknehmen";
  "Supporter werden" (→ `/supporter`) when `canBuy` and not native. Account deletion is
  blocked with "Bitte erst kündigen" while a subscription is live.
- **`AppFooter.vue`**: "Verträge hier kündigen" → `/kuendigen`, on every page.
- **`SpotDetailWeatherLocked.vue`**: **no change.**

### 3.6 Legal pages
`terms.vue` + `privacy.vue` get a Supporter/Creem section (draft copy by Claude, reviewed
by the user / a lawyer before going live). Open point for that review: with Creem as
Merchant of Record, Creem is the seller — check how that shifts the withdrawal-right
notice and §312k obligations. The own `/kuendigen` page is kept regardless.

---

## 4. Testing

Nothing touches production; mock at the HTTP boundary only.

**Backend (deno test)**
- `creem-webhook`: real HMAC with a fixture secret (live/test detection, bad signature → 401); duplicate event → single write; out-of-order older event ignored; full status-mapping table; missing `metadata.user_id` → email fallback; unknown user → 200 + error recorded.
- `billing`: 401 without JWT for checkout/portal/resume; `already_subscribed` / `grant_active` 409s; non-admin `mode:'test'` → live; cancel without JWT gives identical responses with and without a match and sends email only on match; rate limit 429; resume.

**Frontend (vitest)**
- `billing.ts` against mocked fetch (each result variant).
- `subscriptionStore.canBuy` matrix.
- `PlanCard` states; native hiding of buy CTAs.
- `/supporter/danke` with fake timers: success after 3 polls, timeout copy.
- `/kuendigen` logged-in and anonymous paths.
- Structural migration test (like `signupGrantMigration.test.ts`): `past_due` in `get_my_entitlement` and the unique index; RLS enabled with no policies on `billing_events` / `cancel_requests`.
- Architecture test: `communication/billing.ts` has no hardcoded Supabase URL (existing rule covers it — verify).

**E2E**: none required. Optional Playwright smoke test of anonymous `/kuendigen`.

## 5. Rollout

1. User applies the migration; regenerate `database.types.ts`.
2. Creem **test** dashboard: products Supporter monthly + yearly; webhook → `…/functions/v1/creem-webhook`; fill `creem_test` rows in `plan_provider_prices`.
3. Resend: verify `trailradar.org` (SPF/DKIM); set secrets.
4. Deploy `billing` and `creem-webhook` (`--no-verify-jwt` for the webhook).
5. Ship the frontend.
6. Admin end-to-end in test mode: buy → thank-you → profile → portal → cancel → resume → expiry.
7. Go-live gate: prices final, Creem live products + webhook + `creem` rows, legal copy reviewed, Open-Meteo commercial licence in place.
