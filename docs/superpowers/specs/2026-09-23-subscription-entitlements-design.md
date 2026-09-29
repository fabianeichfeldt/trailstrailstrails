# Paid subscriptions: data model + entitlement framework

Date: 2026-09-23

## Scope

This spec covers the **foundation** for paid subscriptions: the database
schema, a provider-agnostic entitlement model, and a framework for checking
"does this user have access to feature X" on both the frontend (UX-only) and
backend (Postgres RLS, the actual security boundary). It also covers
grandfathering every existing user as an `early_adopter`.

It deliberately does **not** cover:

- Which payment processor to integrate, or the checkout/purchase flow itself.
- Which concrete features are actually gated behind a paid tier (no premium
  features exist yet — this spec uses one illustrative example,
  `offline_gpx_download`, without implementing it).
- Any billing/upgrade UI, admin plan-management UI, or webhook handler.

These are separate future specs. See "Out of scope" at the end for what each
of those needs before it can be built.

## Context

TrailRadar has no payment or subscription infrastructure today. It does have
an existing role system (`user_roles`, `get_my_role()` SECURITY DEFINER RPC,
`can_edit_spot()`) documented in `CLAUDE.md` — the entitlement framework
below deliberately mirrors that pattern rather than inventing a new one.

TrailRadar ships as a web app (SSG, GitHub Pages + Cloudflare Workers), an
installed PWA, and a Capacitor native app on iOS/Android. Because the
audience is primarily German-speaking (EU/Switzerland, not US), and Apple/
Google's rules on unlocking in-app features via a web-only purchase are
region-dependent and non-trivial (Apple's guideline 3.1.1 generally requires
in-app purchase to unlock features, with the external-purchase-link
exception currently limited mainly to the US storefront; EU has a separate
DMA-specific entitlement; Switzerland is neither), the payment processor
decision is deferred. The schema is designed **provider-agnostic** so that
decision doesn't block this work and can be slotted in later without
reshaping the schema.

## Data model

Four new tables.

```sql
-- Ordered, numeric tiers. level 0 = free (not a paid plan, but useful as a floor).
CREATE TABLE subscription_plans (
  id            text PRIMARY KEY,        -- 'free', 'plus', 'pro'
  name          text NOT NULL,
  level         int NOT NULL UNIQUE,     -- 0, 1, 2 — ordering for entitlement checks
  price_monthly_cents int,
  price_yearly_cents  int,
  currency      text DEFAULT 'EUR',
  active        boolean DEFAULT true     -- lets you retire a plan without deleting history
);

-- Maps a plan to a specific payment provider's price/product id.
-- Empty until a processor is chosen — that's the only table a future
-- "wire up Stripe" spec needs to populate.
CREATE TABLE plan_provider_prices (
  plan_id       text REFERENCES subscription_plans(id),
  provider      text NOT NULL,           -- 'stripe' | 'apple' | 'google' | 'revenuecat'
  interval      text NOT NULL,           -- 'monthly' | 'yearly'
  provider_price_id text NOT NULL,
  PRIMARY KEY (plan_id, provider, interval)
);

-- Append-only subscription history. At most one row per user with
-- status IN ('active','trialing') — enforced by a partial unique index.
CREATE TABLE subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id       text NOT NULL REFERENCES subscription_plans(id),
  provider      text NOT NULL,           -- 'stripe' | 'apple' | 'google' | 'manual'
  provider_subscription_id text,         -- null for 'manual' grants
  status        text NOT NULL,           -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired'
  discount_percent int DEFAULT 0,        -- carried over from early_adopter_grants at signup time
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX one_active_subscription_per_user
  ON subscriptions (user_id) WHERE status IN ('active', 'trialing');

-- One-time grant, backfilled for every user that exists at feature launch.
-- Never written to again except by the entitlement function reading it.
CREATE TABLE early_adopter_grants (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at    timestamptz DEFAULT now(),
  free_tier_id  text NOT NULL REFERENCES subscription_plans(id),  -- top tier at launch
  free_until    timestamptz NOT NULL,     -- granted_at + 6 months, tunable at migration time
  discount_percent int NOT NULL DEFAULT 20
);
```

**RLS:** `subscription_plans`/`plan_provider_prices` are public-readable
(anyone needs to see pricing), admin-write-only. `subscriptions` and
`early_adopter_grants` are readable only by the owning user
(`user_id = auth.uid()`) and admin, writable only by `service_role` (a
future webhook handler) or admin — never directly by the client, same
posture as `user_roles`.

## Entitlement resolution

One `SECURITY DEFINER` function, mirroring `get_my_role()`:

```sql
CREATE OR REPLACE FUNCTION public.get_my_entitlement()
RETURNS TABLE(plan_id text, level int, discount_percent int, early_adopter_free_until timestamptz)
LANGUAGE sql SECURITY DEFINER AS $$
  WITH active_sub AS (
    SELECT s.plan_id, p.level, s.discount_percent
    FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
    WHERE s.user_id = auth.uid() AND s.status IN ('active', 'trialing')
  ),
  early_adopter AS (
    SELECT g.free_tier_id AS plan_id, p.level, g.discount_percent, g.free_until
    FROM early_adopter_grants g JOIN subscription_plans p ON p.id = g.free_tier_id
    WHERE g.user_id = auth.uid() AND g.free_until > now()
  )
  SELECT plan_id, level, discount_percent, NULL::timestamptz
  FROM active_sub
  UNION ALL
  SELECT plan_id, level, discount_percent, free_until
  FROM early_adopter
  ORDER BY level DESC
  LIMIT 1;
$$;
```

If neither CTE has a row, the caller gets an empty result set — both the
frontend and the RLS helper below treat that as `level = 0` (free).

**Precedence rule:** an active paid subscription and an unexpired
early-adopter grant are compared, and the higher tier wins. This means an
early adopter can still upgrade past their free tier during their free
window, and nobody loses access when their free window lapses if they've
since paid for something at or above that level.

A second, cheaper helper for use directly inside RLS policies (same pattern
as `can_edit_spot`):

```sql
CREATE OR REPLACE FUNCTION public.has_min_tier(required_level int)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE((SELECT level FROM get_my_entitlement()), 0) >= required_level;
$$;
```

### Backend usage pattern

**`has_min_tier(n)` is the one function any new INSERT/SELECT/UPDATE policy
on a gated table or storage bucket calls** — the same role `can_edit_spot()`
plays for trailcrew writes. No feature-key concept exists in Postgres;
policies hardcode the numeric level they require, exactly like
`can_edit_spot` hardcodes the spot check.

**Worked example** (illustrative only — not implemented this round): if
offline GPX download becomes a `level >= 1` feature, the storage policy on
the `gpx-files` bucket gains a SELECT clause alongside the existing
trailcrew INSERT/UPDATE ones:

```sql
CREATE POLICY "premium gpx download" ON storage.objects
  FOR SELECT USING (bucket_id = 'gpx-files' AND public.has_min_tier(1));
```

## Frontend framework

**`app/communication/subscriptions.ts`** (new — follows the `Api.ts` gold
standard: raw REST, no Supabase client):

```typescript
import { REST, userHeaders } from './http'

export interface Entitlement {
  planId: string          // 'free' when no row comes back
  level: number
  discountPercent: number
  earlyAdopterFreeUntil: string | null
}

export async function getMyEntitlement(jwt: string): Promise<Entitlement> {
  const res = await fetch(`${REST}/rpc/get_my_entitlement`, {
    method: 'POST', headers: userHeaders(jwt), body: '{}',
  })
  const rows = await res.json()
  const row = rows[0]
  return row
    ? { planId: row.plan_id, level: row.level, discountPercent: row.discount_percent, earlyAdopterFreeUntil: row.early_adopter_free_until }
    : { planId: 'free', level: 0, discountPercent: 0, earlyAdopterFreeUntil: null }
}
```

**`app/entitlements/features.ts`** (new — the *only* place feature keys are
declared; the manual, human-kept-in-sync counterpart to whatever numeric
literal a matching RLS policy hardcodes, same relationship `DETAIL_ENDPOINT`
has to the trail-type union):

```typescript
export const FEATURES = {
  offline_gpx_download: { minLevel: 1, label: 'Offline-Download' },
  // future feature keys go here — one line each
} as const
export type FeatureKey = keyof typeof FEATURES
```

**`app/stores/subscription.ts`** (new store — its own domain, per the "each
store owns one domain" rule; not folded into `auth.ts` because tier/billing
state is a different concern from identity/role, even though both are
fetched the same way — on login):

```typescript
export const useSubscriptionStore = defineStore('subscription', () => {
  const auth = useAuthStore()
  const entitlement = ref<Entitlement>({ planId: 'free', level: 0, discountPercent: 0, earlyAdopterFreeUntil: null })

  async function load() {
    if (!auth.isLoggedIn) { entitlement.value = { planId: 'free', level: 0, discountPercent: 0, earlyAdopterFreeUntil: null }; return }
    entitlement.value = await getMyEntitlement(await auth.getToken())
  }
  watch(() => auth.user, load, { immediate: true })

  function hasFeature(key: FeatureKey): boolean {
    return entitlement.value.level >= FEATURES[key].minLevel
  }

  const isEarlyAdopter = computed(() => entitlement.value.earlyAdopterFreeUntil !== null)

  return { entitlement, hasFeature, isEarlyAdopter, load }
})
```

**Usage** — the whole point of the framework, one line at any call site:

```vue
<button v-if="subscription.hasFeature('offline_gpx_download')" @click="downloadGpx">
```

No standalone `useFeature()` composable — `subscription.hasFeature(key)` off
the store is already the one-liner, and a wrapper composable would just
forward to it without adding anything.

### Security model

`subscription.hasFeature(key)` and `FEATURES` in
`app/entitlements/features.ts` exist purely to hide/show UI — they run
entirely in the browser and can be spoofed via devtools (patch the store,
flip `level` to 99). That's harmless by design: spoofing it only reveals a
hidden button; pressing that button still has to pass a `has_min_tier(n)`
RLS check server-side to do anything.

**Every gated table, storage bucket, or RPC must have a matching
Postgres-side check — there is no such thing as a frontend-only gated
feature.** A code reviewer should treat a new `FEATURES` entry with no
corresponding RLS policy as a bug, not a convenience. This is the same trust
model `isAdmin`/`isTrailcrew` already use in this codebase (UI-level guard +
DB-level RLS guard — see `CLAUDE.md`'s SpotManager section).

## Early-adopter backfill migration

One-time, run as part of the migration that ships this feature — **not** a
trigger, so new signups after this point never get a row:

```sql
INSERT INTO early_adopter_grants (user_id, free_tier_id, free_until, discount_percent)
SELECT id, 'pro', now() + interval '6 months', 20
FROM auth.users;
```

`'pro'` (top tier), 6 months, and 20% are seed defaults to tune before this
migration is applied — not architectural decisions, just values in a SQL
file.

## Testing

- Unit tests (vitest) for `getMyEntitlement()` in `app/communication/`,
  mocked at the HTTP boundary per `CLAUDE.md`'s test rules.
- Unit tests for `subscription.hasFeature()` covering: no entitlement row
  (free/level 0), active paid subscription at/above/below a feature's
  `minLevel`, unexpired early-adopter grant, expired early-adopter grant,
  and the precedence case (paid subscription + early-adopter grant present
  simultaneously — higher level wins).
- A Postgres-level test (or documented manual check, matching how
  `can_edit_spot` is currently verified) for `has_min_tier()`'s precedence
  logic and the `one_active_subscription_per_user` partial unique index.
- `npx supabase gen types typescript` regeneration after the migration, per
  `CLAUDE.md`'s Supabase rules (new tables/RPC).

## Out of scope (future specs)

- **Payment processor integration** — Stripe checkout for web, later native
  IAP/RevenueCat if purchasing expands into the app. `plan_provider_prices`
  and `subscriptions.provider`/`provider_subscription_id` exist to receive
  this without a schema change.
- **Webhook handler** that writes `subscriptions` rows from processor
  events — needs its own design; given "no live Nitro server in
  production" (`CLAUDE.md`), this likely has to be a Cloudflare Worker, same
  pattern as `/_embed`.
- **Which features are actually premium** — only `offline_gpx_download`
  exists as an illustrative placeholder; deciding the real feature list and
  adding their RLS policies is separate work.
- **Billing/upgrade UI** — plan picker, checkout button, "manage
  subscription" page, admin plan-management UI. Plans are seeded/edited
  directly in Supabase for now, same precedent as trail approval (per
  `CLAUDE.md`: "currently handled directly in Supabase — there is no
  approval UI yet").
- **Admin visibility into early adopters / manual comps** — no UI; direct
  SQL, same as everything else admin-only today.
