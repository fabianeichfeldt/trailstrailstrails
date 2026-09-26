# TrailRadar — Claude Code instructions

## Project in one line
Nuxt 4 + Pinia + Supabase + Leaflet app for discovering legal MTB trails. SSG via `nuxt generate`, deployed to GitHub Pages + Cloudflare Workers. PWA for mobile. Target audience: mountainbikers — tech-savvy, expect a polished modern app aesthetic (custom CSS, no component framework).

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

### SpotManager (`app/spot_manager/`)
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

### Embedded maps

Two different surfaces, don't conflate them:

- **Spot-detail pages** (`trails/[slug].vue`, trail branch) render their map as an **inline Vue component** (`SpotDetailMiniMap.vue` → `app/map/miniMap.ts`), fed by the data already in `spotPanelStore` (through the `communication/` REST layer, so it's offline-cacheable). No iframe, no token, no worker, no `postMessage`. This reverses the earlier "spot page embeds itself through `/embed/[token]`" decision (the double-Leaflet-bundle cost) — for the spot page only.
- **Region overview pages** (`trails/[slug].vue`, region branch) **and third-party sites** still use the `/embed/[token]` iframe + `/_embed` Cloudflare Worker (`embed.js` snippet, host allowlist, admin token UI). `app/pages/embed/[token].vue` renders through the same `app/map/miniMap.ts` module. The region iframe needs the interim `EMBED_BASE = import.meta.dev ? '' : 'https://trailradar.org'` gate so it resolves in the Capacitor native shell (origin `https://localhost`).

---

## Supabase rules

These facts are not derivable from reading the TypeScript code — get them wrong and writes silently fail or bypass security.

- **Role resolution:** always use the `get_my_role()` SECURITY DEFINER RPC (see `stores/auth.ts`). Never query `user_roles` directly from client code — it requires a fallback only if the RPC fails.
- **Write gate for trailcrew:** `can_edit_spot(spot_id)` is the single Postgres function that authorises trailcrew writes. It returns true if the caller is admin, or if the caller is trailcrew with a matching row in `trailcrew_spots`. Any new INSERT/UPDATE policy on spot-related tables must use this function.
- **DELETE is admin-only** on `spot_gpx_trails`, `spot_gpx_tours`. Trailcrew can insert and update but not delete.
- **RLS is enforced on all write tables.** The anon key is embedded in client JS — all write protection is in Postgres, not in application code.
- **Paid features are gated by an edge function, never by the client alone.** The function checks the JWT and calls `has_min_tier(level)` as the caller; the client's `useFeatureAccess` only decides what to render. Example: `trail-condition` in `trailradar-backend` (its `REQUIRED_LEVEL` must equal `FEATURES.trail_condition.minLevel`); the client side is `app/communication/weather.ts` → `useTrailCondition`.
- **Key tables:** `user_roles` (role per user), `trailcrew_spots` (user ↔ assigned spot), `trail_details` (status/rules/description per spot), `spot_gpx_trails`, `spot_gpx_tours`, `embed_tokens`, `embed_token_trails`.
- **`app/types/database.types.ts` is generated, gitignored, and machine-local.** It types the handful of places using `useSupabaseClient()` directly (`stores/auth.ts`, `stores/trails.ts`, `AddSpotModal.vue`, `profile.vue`, `plugins/auth.client.ts`) — most data fetching goes through the raw-REST `communication/` layer instead, which this file doesn't affect. Without it, `@nuxt/supabase` logs a harmless `Database = unknown` warning and those few call sites lose autocomplete/type-checking on table and column names. **Regenerate it after any schema change** (new/renamed table or column, new RPC): `npx supabase gen types typescript --project-id ixafegmxkadbzhxmepsd --schema public > app/types/database.types.ts` (requires the Supabase CLI logged in with access to the project — run this yourself rather than asking Claude to run it non-interactively).

---

## No live Nitro server in production

SSG deploy = no server at runtime. A `server/api/*.ts` route only works in prod if the prerender crawler bakes it into `.output/public/api/...` at build time — otherwise `$fetch()` 404s silently (often masked by `default: () => []`). Don't add server/api routes expecting live execution; fetch Supabase REST directly from the client instead (`REST`/`anonHeaders()` in `http.ts`, pattern: `getLatestPhotos` in `trails.ts`).

**Never add a `server/api/**` or `server/routes/**` file with a dynamic segment** (`[id]`, `[slug]`, ...) — it only works for whichever values existed in the DB at the *last* build; anything added or changed since 404s silently in production, with dev (live Nitro) and the mocked test suite both unable to catch it. This shipped once already: `trails/[slug].vue` called `server/api/trail/[id].get.ts`, and production broke while every test stayed green, because `tests/fixtures.ts` mocked that route directly instead of exercising a real static build — see `app/architecture.test.ts`'s "No dynamic server/api routes" test, which now enforces this (fails the build if you add one without an explicit, justified exemption there). `server/routes/_embed/[token].get.ts` is the one existing exception — it's served by a separately-deployed Cloudflare Worker, not this build's own Nitro output.

---

## Mandatory rules

### Tests must stay green
- **Always run `npm test` before reporting work done.** All unit tests must pass.
- Playwright E2E: run `npm run test:e2e` when touching map interaction, auth flow, or add-spot flow.
- **Every bug fix and every new feature needs a corresponding test.** If you add a function, add a unit test. If you add a user flow, extend the Playwright spec.
- The architecture tests in `app/architecture.test.ts` enforce structural invariants — if you change architecture, update those tests to match the new target, don't just delete the assertion.
- **When fixing a bug, write a failing test first.** The test must fail on the broken code before you touch the fix. A test that passes before the fix is not acceptable.
- **Tests must never call the production database.** Use a placeholder `SUPABASE_URL` (e.g. `http://localhost:54321`) in the test environment. Mock at the HTTP boundary if DB behaviour is needed.
- **Prefer vitest over Playwright.** Default to vitest for all new tests. Only use Playwright when the behaviour genuinely cannot be tested with vitest (e.g. real browser rendering, real auth cookie flows).

### Mobile is first-class
- Every UI change must work on mobile. Check touch targets, scrolling, and layout at small viewports before reporting done.
- **No browser chrome outside a normal tab.** The app also runs as an installed PWA (standalone display-mode) and inside the Capacitor native shell. In those contexts there's no URL bar and no browser back button; swipe-back is unreliable or absent. Android native has a global hardware-back handler (`plugins/capacitor.client.ts` → `window.history.back()`), but **iOS native and standalone PWA have nothing** — a full-page route the user lands on there is a dead end unless it ships its own visible "back" affordance. Content pages use a static `<NuxtLink to="/map" class="back-link">← Zurück zur Karte</NuxtLink>`. Pages reachable by client-side nav from the map (`trails/[slug]`) use `useBackNavigation()` (`app/composables/useBackNavigation.ts`) instead: `router.back()` when there's in-app history (returns to the map with its pan/zoom/panel state), hard-navigate to `/map` when the page was opened cold from a shared link / search / home-screen icon / push. Test any new top-level page by opening it as the *first* page in the iOS app or a standalone window.

### Ask, don't assume
- If the intended design or architectural target for a task is unclear, **ask before implementing**. A wrong assumption costs more to undo than a 30-second clarification.
- This applies especially to: new user flows, new API endpoints, changes that span multiple layers, and anything that touches the filter/marker pipeline.

### Git commits & worktrees
- **Never commit to `main` directly** unless the user explicitly says to in that request. Default: work happens in an isolated **git worktree**, not a feature branch in the primary checkout. An explicit "commit to main" / "commit directly to main" for the task at hand lifts this — for that request only, not as a new standing default.
- **Start new tasks with the `EnterWorktree` tool**, not `git checkout -b`. It creates an isolated working directory + new branch under `.claude/worktrees/` and switches the session into it, so the primary checkout's `main` stays untouched and other in-flight work is never disturbed. Use it at the start of a task, before making changes — don't ask first, just start the worktree (this project has opted in to worktrees, so `EnterWorktree`'s "only when explicitly instructed" condition is satisfied by this file).
- If already mid-task on a plain feature branch in the primary checkout (not a worktree) when this rule applies, that's fine to finish out — don't migrate work-in-progress into a worktree mid-task. Start the next task in a worktree instead.
- Commit at logical checkpoints inside the worktree — it lets the user review progress and keeps the work recoverable.
- Only call `ExitWorktree` when the user asks to leave or wrap up that piece of work. Default to `action: "keep"` (branch + directory stay on disk) unless the user says the work is abandoned/no longer needed, in which case `action: "remove"`.
- The user merges finished worktree branches into `main` themselves, and removes the worktree once merged (or asks Claude to `ExitWorktree` with `remove`).

---

## `srcDir: 'app'` — path traps

- `~/` = `app/`, `@@/` = project root. Use `@@/build/region`, never `~/build/...`.
- `public/` and `server/` are **root-level**, siblings of `app/`, not nested inside it — Nuxt 4 resolves them relative to the project root even though `srcDir` is `app`. Don't move them under `app/public/` or `app/server/`; Nuxt won't find them there.
- Inside `app/` or `server/`, never reach *into* the other tree with a literal `~/server/...` or similar srcDir-relative alias — `~/` only resolves inside `app/`. Use the root alias instead: `@@/server/...`.
- Image tags for public assets: `:src="'/assets/foo.webp'"` not `src="/assets/foo.webp"` — Vite transforms static `src=` into a module import from `app/`, which misses root-level `public/`.
- Never write `../../app/something` from inside `app/` — resolves to `app/app/` (double segment).
- CSS imports in TS modules: relative paths only (`../css/foo.css`), never `/app/css/foo.css`.

Full rationale: `docs/folder-structure-plan.md`.

---

## Architecture

### Dependency layers (bottom → top; lower layers must not import higher)

```
app/anon.ts
  └── app/communication/http.ts        (shared HTTP client, env-based URL)
        └── app/communication/*.ts     (data/API functions)
              └── app/map/             (map UI, receives deps via injection)
              └── app/stores/          (Pinia state — imports communication/, never map/)
                    └── app/composables/   (Vue composables — orchestrates stores + map)
                          └── app/components/ / app/pages/
```

**Enforced by:** `app/architecture.test.ts` (vitest) + `.dependency-cruiser.cjs`

### Key rules per layer

**`app/communication/`**
- No hardcoded Supabase project URL. Always use `REST`, `FUNCTIONS`, `anonHeaders()`, `userHeaders(token)` from `./http.ts`.
- Must not import from `stores/`, `composables/`, or `app/map/`.
- Gold standard to follow: `app/spot_manager/Api.ts`.

**`stores/`**
- Each store owns one domain: `auth`, `trails`, `filters`, `map`, `spotPanel`.
- Auth store owns auth state and auth operations only (signIn/signUp/signOut/profile). Photo/file uploads that also write to DB tables belong in `app/communication/`.
- `spotPanel` store (`app/stores/spotPanel.ts`) owns all spot-panel state: which spot is open, active tab, tour/trail selection, parking lots, comments. `SpotPanel.vue` and its child components (`SpotPanelHeader.vue`, `SpotPanelTabs.vue`, `SpotPanelInfoTab.vue`, etc.) read/write it directly.
- Must not import from `app/map/`.

**`composables/`**
- `useTrailMap` owns the live `/map` Leaflet instance (client-only, inside `onMounted`) — the interactive map, its markers, and the spot panel's Leaflet-side effects (trail polyline restyling, tour-segment layers, the hover marker) as `watch()`es on `useSpotPanelStore()` — see `SpotPanel.vue`/`app/stores/spotPanel.ts`. The **only** other place Leaflet `L` lives is `app/map/miniMap.ts`, the read-only mini-map renderer for the spot-detail page (`SpotDetailMiniMap.vue`) and the third-party embed page (`/embed/[token]`); it dynamic-imports `leaflet` inside `createMiniMap()` and takes no store/composable deps.
- Filter logic lives exclusively in `filtersStore.apply()`. The composable calls it — never reimplements it inline.
- Do not reach into the DOM with `getElementById` from composables. Reactive state should live in the component.

**`app/map/`**
- Receives auth/state via constructor injection (not by importing stores).
- Must not import from `stores/`.

### Adding a new spot type
1. Add a new interface in `app/types/Trail.ts` extending `BaseTrail`, add it to the `Trail` union, add a type guard.
2. Add an entry to `DETAIL_ENDPOINT` in `app/communication/trails.ts` — **nothing else in that file changes**.
3. Add a filter entry in `stores/filters.ts` `apply()`.
4. Add a marker category in `composables/useTrailMap.ts` `createCustomIcon()`.
5. Add entries to `server/api/trails.get.ts` and to `getTrailById()` in `app/communication/trails.ts` (the trails/[slug].vue detail-page fetch — a direct Supabase REST call, not a server/api route; see "No live Nitro server in production" above for why).
6. Update `app/architecture.test.ts` if any new invariants apply.

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
| `npm run verify:static-build` | Real `nuxt generate` build, served as pure static files (no live Nitro), checks a real trail page actually renders. Runs in CI as a step in the `build` job (`.github/workflows/deploy.yml`), right after `generate` and before the deploy artifact is uploaded — a failure blocks the deploy. Not part of `npm test` (needs real Supabase creds, takes minutes) — run it manually too before/after changes to trail/spot data fetching |

**Test locations:**
- Unit tests: `app/**/*.test.ts` (picked up by vitest automatically)
- Architecture tests: `app/architecture.test.ts`
- E2E tests: `tests/*.spec.ts`
- Static-build verification: `scripts/verify-static-build.mjs`

---

## Key files

| File | Role |
|---|---|
| `app/communication/http.ts` | Shared HTTP client — single source of Supabase URL and auth headers |
| `app/communication/trails.ts` | Trail/GPX data fetching |
| `app/communication/photos.ts` | Trail photo upload + image resizing |
| `app/spot_manager/Api.ts` | Admin/trailcrew API — **gold standard for HTTP layer design** |
| `app/spot_manager/GpxProcessor.ts` | GPX parsing, RDP thinning, Fréchet matching — pure functions |
| `app/types/Trail.ts` | Discriminated union + type guards — **the canonical trail type system** |
| `app/stores/auth.ts` | Auth state + auth operations only |
| `app/stores/filters.ts` | Single source of truth for all trail-type visibility filtering |
| `app/stores/spotPanel.ts` | Spot panel state (open spot, active tab, tour/trail selection, parking, comments) — **gold standard for this kind of panel** |
| `app/components/map/SpotPanel.vue` | Top-level spot panel shell — mounted as a sibling of `<MapView>` in `app/pages/map.vue`; assembles the header/tabs/info/tours/trails/parking/elevation child components |
| `app/map/miniMap.ts` | Read-only Leaflet mini-map renderer (`createMiniMap()` → `{ flyTo, setData, destroy }`) — shared by the spot-detail page and the third-party embed page; dynamic-imports `leaflet`, no store/composable deps |
| `app/components/trail_detail/SpotDetailMiniMap.vue` | Inline mini-map on the spot-detail page — wires `spotPanelStore` (data / parkingLots / selectItem) to `createMiniMap`; client-only init, stable SSR placeholder |
| `app/composables/useTrailMap.ts` | Live `/map` init, markers, geolocation, FAB, spot-panel Leaflet effects — client-only |
| `app/architecture.test.ts` | Vitest tests that enforce structural invariants |
| `.dependency-cruiser.cjs` | Import boundary rules |
