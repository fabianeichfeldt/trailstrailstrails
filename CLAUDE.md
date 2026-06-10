# TrailRadar — Claude Code instructions

## Project in one line
Nuxt 3 + Pinia + Supabase + Leaflet app for discovering legal MTB trails. SSG via `nuxt generate`, deployed to GitHub Pages + Cloudflare Workers. PWA for mobile. Target audience: mountainbikers — tech-savvy, expect a polished modern app aesthetic (custom CSS, no component framework).

---

## Features & roles

### User roles

| Role | How assigned | What they can do |
|---|---|---|
| anonymous | no login | browse map, view trail details, view photos |
| registered user | self-signup | + upload photos, like/favorite spots |
| trailcrew | **invite-only by admin** | + access SpotManager for their assigned spots |
| admin | set directly in DB | + SpotManager for all spots, approve new spots, manage embed tokens, assign trailcrew |

**Why trailcrew is invite-only:** trailcrew members are real trail builders with real-world accountability for the accuracy of a spot's data. Self-signup would let anyone corrupt official status, closure rules, or GPS tracks for a live spot. admin assigns spots to trailcrew via the `trailcrew_spots` junction table in Supabase.

**Trail approval** (new spots submitted by any user) is admin-only and currently handled directly in Supabase — there is no approval UI yet.

### SpotManager (`src/spot_manager/`)
The SpotManager is the privileged maintenance interface, visible only to trailcrew and admin. It allows editing all operational fields of a spot:

- **GPX tracks** — upload, reorder, delete trail and tour GPX files; automatic RDP thinning + Fréchet-based tour segment matching (`GpxProcessor.ts`)
- **Spot details** — open/closed status, status hint, affected trails, seasonal dates, access type, donation URL, rules, description, opening hours
- **Rain/night policies** — rain closure window, night riding window
- **Embed tokens** (admin-only) — create and manage iframe embed tokens with host allowlists and trail pickers

The SpotManager is **not a separate app** — it lives inside the same Nuxt project but is guarded at the UI level (`isTrailcrew` / `isAdmin` computed from `stores/auth.ts`) and at the DB level via RLS.

**SpotManager must use the shared `stores/auth.ts` Pinia store.** Never create a second auth store or local auth state inside SpotManager. A second store causes `sub`/`userId` mismatches and silent auth failures.

### Other features
- **Map** — Leaflet markers for trails, bikeparks, dirtparks; filter by type; geolocation FAB
- **Trail detail pages** — full info, photos, GPX elevation profiles, likes
- **Activity feed** — latest community contributions (new spots, photos, GPX routes)
- **Embed widget** — token-scoped iframe embeds served via Cloudflare Worker (`/_embed/[token]`)

---

## Supabase rules

These facts are not derivable from reading the TypeScript code — get them wrong and writes silently fail or bypass security.

- **Role resolution:** always use the `get_my_role()` SECURITY DEFINER RPC (see `stores/auth.ts`). Never query `user_roles` directly from client code — it requires a fallback only if the RPC fails.
- **Write gate for trailcrew:** `can_edit_spot(spot_id)` is the single Postgres function that authorises trailcrew writes. It returns true if the caller is admin, or if the caller is trailcrew with a matching row in `trailcrew_spots`. Any new INSERT/UPDATE policy on spot-related tables must use this function.
- **DELETE is admin-only** on `spot_gpx_trails`, `spot_gpx_tours`. Trailcrew can insert and update but not delete.
- **RLS is enforced on all write tables.** The anon key is embedded in client JS — all write protection is in Postgres, not in application code.
- **Key tables:** `user_roles` (role per user), `trailcrew_spots` (user ↔ assigned spot), `trail_details` (status/rules/description per spot), `spot_gpx_trails`, `spot_gpx_tours`, `embed_tokens`, `embed_token_trails`.

---

## Mandatory rules

### Tests must stay green
- **Always run `npm test` before reporting work done.** All unit tests must pass.
- Playwright E2E: run `npm run test:e2e` when touching map interaction, auth flow, or add-spot flow.
- **Every bug fix and every new feature needs a corresponding test.** If you add a function, add a unit test. If you add a user flow, extend the Playwright spec.
- The architecture tests in `src/architecture.test.ts` enforce structural invariants — if you change architecture, update those tests to match the new target, don't just delete the assertion.
- **When fixing a bug, write a failing test first.** The test must fail on the broken code before you touch the fix. A test that passes before the fix is not acceptable.
- **Tests must never call the production database.** Use a placeholder `SUPABASE_URL` (e.g. `http://localhost:54321`) in the test environment. Mock at the HTTP boundary if DB behaviour is needed.
- **Prefer vitest over Playwright.** Default to vitest for all new tests. Only use Playwright when the behaviour genuinely cannot be tested with vitest (e.g. real browser rendering, real auth cookie flows).

### Mobile is first-class
- Every UI change must work on mobile. Check touch targets, scrolling, and layout at small viewports before reporting done.

### Ask, don't assume
- If the intended design or architectural target for a task is unclear, **ask before implementing**. A wrong assumption costs more to undo than a 30-second clarification.
- This applies especially to: new user flows, new API endpoints, changes that span multiple layers, and anything that touches the filter/marker pipeline.

---

## Architecture

### Dependency layers (bottom → top; lower layers must not import higher)

```
src/anon.ts
  └── src/communication/http.ts        (shared HTTP client, env-based URL)
        └── src/communication/*.ts     (data/API functions)
              └── src/map/             (map UI, receives deps via injection)
              └── stores/              (Pinia state — imports communication/, never map/)
                    └── composables/   (Vue composables — orchestrates stores + map)
                          └── components/ / pages/
```

**Enforced by:** `src/architecture.test.ts` (vitest) + `.dependency-cruiser.cjs`

### Key rules per layer

**`src/communication/`**
- No hardcoded Supabase project URL. Always use `REST`, `FUNCTIONS`, `anonHeaders()`, `userHeaders(token)` from `./http.ts`.
- Must not import from `stores/`, `composables/`, or `src/map/`.
- Gold standard to follow: `src/spot_manager/Api.ts`.

**`stores/`**
- Each store owns one domain: `auth`, `trails`, `filters`, `map`.
- Auth store owns auth state and auth operations only (signIn/signUp/signOut/profile). Photo/file uploads that also write to DB tables belong in `src/communication/`.
- Must not import from `src/map/`.

**`composables/`**
- `useTrailMap` is the only place Leaflet `L` exists (client-only, inside `onMounted`).
- Filter logic lives exclusively in `filtersStore.apply()`. The composable calls it — never reimplements it inline.
- Do not reach into the DOM with `getElementById` from composables. Reactive state should live in the component.

**`src/map/`**
- Receives auth/state via constructor injection (not by importing stores).
- Must not import from `stores/`.

### Adding a new spot type
1. Add a new interface in `src/types/Trail.ts` extending `BaseTrail`, add it to the `Trail` union, add a type guard.
2. Add an entry to `DETAIL_ENDPOINT` in `src/communication/trails.ts` — **nothing else in that file changes**.
3. Add a filter entry in `stores/filters.ts` `apply()`.
4. Add a marker category in `composables/useTrailMap.ts` `createCustomIcon()`.
5. Add entries to `server/api/trails.get.ts` and `server/api/trail/[id].get.ts`.
6. Update `src/architecture.test.ts` if any new invariants apply.

### Open/Closed pattern for trail type dispatch
```typescript
// CORRECT — closed to modification when a new type is added
const ENDPOINT: Record<Trail['type'], { path: string; param: string }> = {
  trail:    { path: 'trail-details',      param: 'trail' },
  bikepark: { path: 'bike-parks-details', param: 'id' },
  dirtpark: { path: 'dirt-parks-details', param: 'id' },
}

// WRONG — requires editing when a new type is added
if (isDirtPark(trail)) { ... }
else if (isBikePark(trail)) { ... }
else { ... }
```

---

## Test suite overview

| Command | What it covers |
|---|---|
| `npm test` | unit tests incl. architecture invariant tests |
| `npm run lint:arch` | Import boundary enforcement via dependency-cruiser |
| `npm run test:e2e` | Playwright tests covering map, auth, add-spot, search, filters |

**Test locations:**
- Unit tests: `src/**/*.test.ts` (picked up by vitest automatically)
- Architecture tests: `src/architecture.test.ts`
- E2E tests: `tests/*.spec.ts`

---

## Key files

| File | Role |
|---|---|
| `src/communication/http.ts` | Shared HTTP client — single source of Supabase URL and auth headers |
| `src/communication/trails.ts` | Trail/GPX data fetching |
| `src/communication/photos.ts` | Trail photo upload + image resizing |
| `src/spot_manager/Api.ts` | Admin/trailcrew API — **gold standard for HTTP layer design** |
| `src/spot_manager/GpxProcessor.ts` | GPX parsing, RDP thinning, Fréchet matching — pure functions |
| `src/types/Trail.ts` | Discriminated union + type guards — **the canonical trail type system** |
| `stores/auth.ts` | Auth state + auth operations only |
| `stores/filters.ts` | Single source of truth for all trail-type visibility filtering |
| `composables/useTrailMap.ts` | Map init, markers, geolocation, FAB — client-only |
| `src/architecture.test.ts` | Vitest tests that enforce structural invariants |
| `.dependency-cruiser.cjs` | Import boundary rules |
