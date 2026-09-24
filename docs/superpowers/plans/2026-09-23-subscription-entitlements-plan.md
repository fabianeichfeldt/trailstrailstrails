# Implementation plan: subscription entitlements foundation

Date: 2026-09-23
Spec: `docs/superpowers/specs/2026-09-23-subscription-entitlements-design.md`
Reference SQL: `docs/superpowers/specs/2026-09-23-subscription-entitlements.sql`

(No `writing-plans` skill is installed in this environment, so this plan was
written directly rather than through that skill. Structure/intent is the
same: concrete steps, file-by-file, tests named up front.)

## Before starting

Per `CLAUDE.md`, start implementation with `EnterWorktree` — don't edit code
in the primary checkout on `main`. This plan document itself was written
directly on `main`, same as the spec and reference SQL, since it's still a
planning artifact, not code.

## Step 1 — Migration + plan seed rows

Copy `docs/superpowers/specs/2026-09-23-subscription-entitlements.sql` into
`supabase/migrations/<timestamp>_add_subscription_entitlements.sql`
(timestamp format matching existing migrations, e.g.
`20260923HHMMSS_add_subscription_entitlements.sql`). Strip the "NOT a
migration" header comment.

**One real fix needed, not just a copy:** the reference SQL's backfill
INSERT requires a `'pro'` row to already exist in `subscription_plans`, but
per the design, plans are meant to be seeded directly in Supabase — nothing
in the file creates them. If the migration is applied as-is, the backfill
fails its FK check. Add a seed INSERT for the three tiers immediately after
`CREATE TABLE subscription_plans`, before the backfill section:

```sql
INSERT INTO "public"."subscription_plans" ("id", "name", "level", "price_monthly_cents", "price_yearly_cents") VALUES
  ('free', 'Free', 0, NULL, NULL),
  ('plus', 'Plus', 1, NULL, NULL),
  ('pro',  'Pro',  2, NULL, NULL);
```

Prices stay `NULL` until real pricing is decided — that's a business
decision outside this spec's scope, not a blocker for the schema.

**Manual steps (user runs these, not Claude — per `CLAUDE.md`'s Supabase
rules, these need an interactively-logged-in Supabase CLI):**
- Apply the migration to the project.
- Regenerate types: `npx supabase gen types typescript --project-id ixafegmxkadbzhxmepsd --schema public > app/types/database.types.ts`.

No automated test covers this step — it's schema, not application code. The
existing `can_edit_spot`/`get_my_role` precedent in this repo has no vitest
coverage either; parity is intentional.

## Step 2 — Communication layer

**New file:** `app/communication/subscriptions.ts`

```typescript
import { REST, userHeaders } from './http'

export interface Entitlement {
  planId: string
  level: number
  discountPercent: number
  earlyAdopterFreeUntil: string | null
}

const FREE_ENTITLEMENT: Entitlement = { planId: 'free', level: 0, discountPercent: 0, earlyAdopterFreeUntil: null }

export async function getMyEntitlement(jwt: string): Promise<Entitlement> {
  const res = await fetch(`${REST}/rpc/get_my_entitlement`, {
    method: 'POST', headers: userHeaders(jwt), body: '{}',
  })
  if (!res.ok) return FREE_ENTITLEMENT
  const rows = await res.json()
  const row = rows[0]
  if (!row) return FREE_ENTITLEMENT
  return {
    planId: row.plan_id,
    level: row.level,
    discountPercent: row.discount_percent,
    earlyAdopterFreeUntil: row.early_adopter_free_until,
  }
}
```

The `!res.ok` fallback isn't in the design doc's pseudocode but matches this
file's own sibling conventions (`getComments` in `comments.ts` returns `[]`
on a failed fetch rather than throwing) — a network/auth failure degrades to
"treat as free," not a crash.

**New test file:** `app/communication/subscriptions.test.ts`, same shape as
`app/communication/comments.test.ts` (`vi.stubGlobal('fetch', ...)`, local
`ok()`/`err()` helpers, `afterEach(() => vi.unstubAllGlobals())`):

- posts to `${REST}/rpc/get_my_entitlement` with `userHeaders(jwt)` (asserts
  URL, method `POST`, `Authorization: Bearer <jwt>`)
- returns the mapped `Entitlement` when a row comes back
- returns `FREE_ENTITLEMENT` when the RPC returns an empty array (no active
  subscription, no early-adopter grant)
- returns `FREE_ENTITLEMENT` when the fetch fails (`res.ok === false`)

## Step 3 — Feature registry

**New file:** `app/entitlements/features.ts`

```typescript
export const FEATURES = {
  offline_gpx_download: { minLevel: 1, label: 'Offline-Download' },
} as const

export type FeatureKey = keyof typeof FEATURES
```

Pure data, no logic, no imports — no dedicated test file. (Contrast with
`trailTooltip.ts`, which gets an architecture test because it's a pure
*logic* layer with an import-boundary invariant to enforce; this file has no
such invariant to break.)

## Step 4 — Subscription store

**New file:** `app/stores/subscription.ts`

```typescript
import { getMyEntitlement, type Entitlement } from '~/communication/subscriptions'
import { FEATURES, type FeatureKey } from '~/entitlements/features'

const FREE_ENTITLEMENT: Entitlement = { planId: 'free', level: 0, discountPercent: 0, earlyAdopterFreeUntil: null }

export const useSubscriptionStore = defineStore('subscription', () => {
  const auth = useAuthStore()
  const entitlement = ref<Entitlement>(FREE_ENTITLEMENT)

  async function load() {
    if (!auth.isLoggedIn) { entitlement.value = FREE_ENTITLEMENT; return }
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

This is the first store-to-store import in the codebase (`useAuthStore()`
called from inside another store) — already implicit in the approved spec's
pseudocode, not a new decision being made here, but worth calling out in the
commit message since it's a new pattern for whoever reads it later.

**New test file:** `app/stores/subscription.test.ts`, following
`app/stores/auth.test.ts`'s setup (`setActivePinia(createPinia())`,
`vi.stubGlobal('useSupabaseClient', ...)`, `vi.stubGlobal('useSupabaseUser',
...)` — extend the existing mock client with `getSession` since
`auth.getToken()` calls it) plus `vi.stubGlobal('fetch', ...)` for the
underlying `getMyEntitlement` call:

- `entitlement` stays the free default when `useSupabaseUser()` yields no
  user (logged out) — `getMyEntitlement`/`fetch` is never called
- `load()` fetches and stores the entitlement when a user is present
- `hasFeature('offline_gpx_download')` is `false` at level 0, `true` at
  level 1 and above
- `isEarlyAdopter` is `true` only when `earlyAdopterFreeUntil` is non-null,
  regardless of `level`

## Explicitly not touched

No component imports `useSubscriptionStore` or `hasFeature()` anywhere. No
RLS policy on `gpx-files` storage changes. No billing/upgrade UI. This
matches the spec's "Out of scope" section — the framework ships wired
end-to-end but inert, provable only by its own unit tests.

## Verification

- `npm test` — all unit tests green, including the new ones above and the
  existing `app/architecture.test.ts` suite (no changes expected there; the
  new files don't violate any existing invariant — `subscriptions.ts`
  doesn't import `stores/`/`composables/`, `subscription.ts` doesn't import
  `app/map/`).
- `npm run lint:arch` — dependency-cruiser passes with the new files.
- No Playwright/E2E needed — nothing in map interaction, auth flow, or the
  add-spot flow changes.

## Commit checkpoints (inside the worktree)

1. Migration + plan seed rows (Step 1).
2. `app/communication/subscriptions.ts` + test (Step 2).
3. `app/entitlements/features.ts` + `app/stores/subscription.ts` + test
   (Steps 3–4, small enough to combine).

Each checkpoint should leave `npm test` green before moving to the next.
