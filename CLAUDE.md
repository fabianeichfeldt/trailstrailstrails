# TrailRadar — Claude Code instructions

## Project in one line
Nuxt 3 + Pinia + Supabase + Leaflet app for discovering legal MTB trails. SSG via `nuxt generate`, deployed to GitHub Pages.

---

## Mandatory rules

### Tests must stay green
- **Always run `npm test` before reporting work done.** All unit tests must pass.
- Playwright E2E: run `npm run test:e2e` when touching map interaction, auth flow, or add-spot flow.
- **Every bug fix and every new feature needs a corresponding test.** If you add a function, add a unit test. If you add a user flow, extend the Playwright spec.
- The architecture tests in `src/architecture.test.ts` enforce structural invariants — if you change architecture, update those tests to match the new target, don't just delete the assertion.

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
