# Trail-Zustand behind an edge function — implementation plan

Spec: `docs/superpowers/specs/2026-09-24-trail-condition-edge-function-design.md`
Repos: **B** = `../trailradar-backend`, **F** = this worktree (`worktree-feat+spot-weather`).

Ground rules for whoever executes this:

- F work happens in this worktree; commit at each checkpoint below (never to `main`).
- B has no test runner yet (`npm test` is a stub). Task B1 adds `deno test`.
- Every behaviour change gets a test first (CLAUDE.md). Tests never touch the production database: placeholder `SUPABASE_URL=http://localhost:54321`, mock at the HTTP boundary.
- Ask before assuming schema/RLS intent (B's CLAUDE.md). Tasks marked **[confirm]** stop and check with the user.
- Safe rollback point: phases 1–3 change nothing user-visible. The old client path keeps working until phase 4 lands.

## Resolved open items from the spec

- **`wetnessMm`**: not used by any component. Dropped from the wire contract. The card uses `level`, `headline`, `detail`, `rain10dMm`.
- **Status banner** needs two things only: `current.precipitationMm > 0` (rain "during" rule) and hours since last measurable rain (rain "after" rule). The wire contract carries `rainRule: { raining: boolean; hoursSinceRain: number | null }`, computed by the existing `hoursSinceLastRain`. This replaces the spec's `verdict.hoursSinceRain`, so the banner and the verdict cannot disagree.
- **Icons**: the server sends the emoji `icon` string per day and for `current` (not an `iconKey`), so `weatherCodes.ts` moves entirely to B. The card's `barHeight`/`barClass`/`formatMm`/weekday label stay client-side (pure display).
- **Strip window**: the server returns only the displayed window (2 past days, today, 3 ahead). The 10-day history stays server-side.
- **Spot lookup columns** still need confirming against the real schema (B2).

## Wire contract (final)

```ts
// F: app/types/Weather.ts   B: supabase/functions/_shared/types.ts (identical)
export type ConditionLevel = 'dusty'|'prime'|'damp'|'wet'|'raining'|'snow'|'hard'|'unknown'

export interface TrailConditionResponse {
  verdict: { level: ConditionLevel; headline: string; detail: string; rain10dMm: number }
  rainRule: { raining: boolean; hoursSinceRain: number | null }
  current: { temperature: number; apparentTemperature: number; icon: string; windKmh: number }
  strip: Array<{ date: string; weekday: string; icon: string; precipitationMm: number; isToday: boolean; isForecast: boolean }>
  fetchedAt: string // ISO
}
```

`weekday` is the German two-letter label ("Mo"), `Heute` is derived from `isToday` by the client.

---

# Phase 1 — Backend foundation (B)

## B1. Test runner and layout

- [ ] Add `supabase/functions/deno.json` (or root `deno.json`) with a `test` task running `deno test --allow-env --allow-read supabase/functions`.
- [ ] Add `"test": "deno test ..."` to `package.json` scripts in place of the stub.
- [ ] Create `supabase/functions/_shared/` (Supabase treats `_`-prefixed dirs as shared, not deployable).
- [ ] Update B's `CLAUDE.md`: mention `_shared/`, `deno test`, and the new `supabase/migrations/` folder.
- Verify: `deno test` runs and reports 0 tests.

## B2. Confirm spot schema **[confirm]**

- [ ] Inspect the live schema (Supabase dashboard or `supabase db dump --schema public --data-only=false`) for `trails`, `bike_parks`, `dirt_parks`: primary key type, `latitude`, `longitude`, and on `dirt_parks` the `pumptrack` and `dirtpark` flags.
- [ ] Write the findings into a short table at the top of `supabase/functions/trail-condition/spots.ts` as a comment, and use them in B6.
- [ ] If any table lacks coordinates or uses a different key type than assumed, stop and check with the user before B3.

## B3. Cache table migration

- [ ] Create `supabase/migrations/<timestamp>_add_weather_cache.sql` exactly as in spec section 3, with `spot_id` typed to match B2's finding.
- [ ] Add a comment noting RLS is on with no policies (service role only).
- [ ] Add the "how migrations are applied" note to B's README/CLAUDE.md (`supabase db push`, or the SQL editor if the project stays dashboard-managed). **[confirm]** which one the user wants.
- [ ] Apply to a local Supabase (`supabase start`) and verify the table exists and that an `anon` client gets no rows and cannot insert.
- Do **not** apply to production yet; that happens in phase 3.

# Phase 2 — Move the model into `_shared/` (B)

## B4. Port the model, test-first

Move behaviour unchanged. The existing 414-line `trailCondition.test.ts` is the spec for this move.

- [ ] Copy `app/utils/trailCondition.test.ts` and `app/utils/__fixtures__/*.json` from F to `_shared/` (`trailCondition.test.ts`, `__fixtures__/`). Convert the test file from vitest to `Deno.test` + `jsr:@std/assert` (or `@std/testing/bdd` if the file uses `describe`/`it`, to keep the diff small). Run it: it must **fail** because the module doesn't exist yet.
- [ ] Copy `app/utils/trailCondition.ts` to `_shared/trailCondition.ts`. Adjust imports:
  - `~/types/Weather` → `./types.ts` (new file holding `SpotWeather`, `DayWeather`, `HourlyWeather`, `TrailCondition`, `ConditionLevel`, and the wire types above).
  - `~/types/Trail` (`Trail`, `isDirtPark`) → removed. Replace `conditionModeFor(trail)` with `conditionModeFor(surface: SpotSurface)` where `SpotSurface = { type: 'trail'|'bikepark'|'dirtpark'; pumptrack?: boolean; dirtpark?: boolean }`, keeping the Open/Closed `Record<type, fn>` dispatch.
  - Add `.ts` extensions to relative imports.
  - Add an unused optional `soil?: SoilParams` parameter to `computeTrailCondition` (`SoilParams` is an empty-for-now interface in `types.ts`) with a comment: hook for SoilGrids, changes nothing today.
- [ ] Copy `app/utils/weatherCodes.ts` to `_shared/weatherCodes.ts`.
- [ ] Update tests for the `SpotSurface` signature. Run: all pass, same assertions and fixtures as before.
- [ ] Add `toTrailConditionResponse(weather, surface, now)` in `_shared/viewModel.ts` plus tests:
  - strip window is exactly 2 past + today + 3 ahead (fewer at payload edges), `isToday`/`isForecast` correct, weekday from noon-UTC parse;
  - `rainRule.raining` mirrors `current.precipitationMm > 0`; `hoursSinceRain` equals `hoursSinceLastRain`;
  - **leak test**: `JSON.stringify` of the result contains none of `hourly`, `et0`, `wetnessMm`, `snowfall`, threshold names.
  - unusable payload → `verdict.level === 'unknown'` and empty strip.
- [ ] Commit in B: "feat: move trail-condition model to _shared".

## B5. Move the backtest

- [ ] Copy `scripts/soil-backtest/**` (including `spots.csv`, fixtures, `results/`) from F to `trailradar-backend/scripts/soil-backtest/`.
- [ ] Repoint its imports from `~/utils/trailCondition` to `../../supabase/functions/_shared/trailCondition.ts`, and its runtime from vitest/tsx to Deno (`deno run --allow-net --allow-read --allow-write`). Port its tests likewise.
- [ ] Add `backtest:soil` to B's `package.json` scripts. Run its tests; then a dry run against cached data (no network) to confirm the numbers match the committed summer baseline result.
- [ ] The results JSON is part of the user's ongoing autumn re-run workflow (`--refresh`). Keep it and tell the user the command moved.
- [ ] Commit in B.

# Phase 3 — The function (B), test-first

## B6. `trail-condition` function

Files: `supabase/functions/trail-condition/{index.ts,cors.ts,spots.ts,cache.ts,openMeteo.ts,handler.ts,deno.json}`. Copy `cors.ts` from `add-visit`. Keep `handler.ts` a pure function of injected dependencies so tests need no network or Supabase.

```ts
handler(req, deps: {
  getUser: (jwt) => Promise<UserCtx | null>
  hasMinTier: (jwt, level) => Promise<boolean>   // calls has_min_tier as the caller
  loadSpot: (type, id) => Promise<SpotRow | null>
  cache: { get(type,id): Promise<{fetchedAt,payload}|null>; put(...): Promise<void> }
  fetchWeather: (lat, lon) => Promise<SpotWeather | null>
  now: () => Date
})
```

Write the tests first in `handler.test.ts` (each must fail before implementation):

- [ ] `OPTIONS` → 200 with CORS headers; `GET` → 405; non-JSON body → 400.
- [ ] Invalid `spotType` or missing `spotId` → 400.
- [ ] No `Authorization` header / invalid JWT → 401, and `loadSpot` and `fetchWeather` are never called.
- [ ] Authenticated but `hasMinTier` false → 403, `fetchWeather` never called (this proves an unpaid user cannot spend upstream calls).
- [ ] Unknown spot → 404.
- [ ] Cache hit younger than 1 h → 200, `fetchWeather` not called.
- [ ] Cache miss → `fetchWeather` called once with the spot's coordinates (not client-supplied), result cached, 200.
- [ ] Cache older than 1 h → refetch, cache updated.
- [ ] Upstream failure + stale cache → 200 with the stale-based view-model.
- [ ] Upstream failure + no cache → 502.
- [ ] Asphalt-only dirtpark → response `verdict.level === 'hard'` (surface comes from the DB row, never the request).
- [ ] Response body validates against the wire contract and passes the leak test from B4.

Then implement:

- [ ] `openMeteo.ts`: `buildWeatherUrl` and `mapWeatherResponse` ported from `app/communication/weather.ts` (same parameters: 10 past days, 4 forecast days, same hourly/daily/current variables). Port `weather.test.ts` too. Base URL: `https://customer-api.open-meteo.com/v1/forecast` with `apikey` when `OPEN_METEO_API_KEY` is set, else the free `https://api.open-meteo.com/v1/forecast`.
- [ ] `spots.ts`: dispatch table `Record<SpotType, { table, select, toSurface }>` built from B2's findings.
- [ ] `cache.ts`: `weather_cache` get/upsert via the service-role client.
- [ ] `index.ts`: `Deno.serve` wiring real dependencies, top-level try/catch returning JSON 500 like the other functions. The entitlement check uses a client created with the caller's `Authorization` header; the service-role client is used only for `loadSpot` and `cache`.
- [ ] Add `[functions.trail-condition]` to `supabase/config.toml` (keep `verify_jwt = true`, so the platform rejects unsigned requests before the handler).
- [ ] Add the constant `REQUIRED_LEVEL = 1` with a comment pointing at `FEATURES.trail_condition.minLevel` in F.
- Verify locally: `supabase start`, `supabase functions serve trail-condition`, then curl with (a) no token, (b) a free user's token, (c) a Plus user's token, against a seeded spot. Confirm 401/403/200, and that a second call within an hour makes no upstream request (function logs).
- [ ] Commit in B.

## B7. Deploy, backend side **[confirm]**

- [ ] With the user's OK: apply the migration to the production project, set the `OPEN_METEO_API_KEY` secret if a key exists (optional at this stage), `supabase functions deploy trail-condition`.
- [ ] Smoke test production with real tokens for a free and an entitled user. Note: every existing user currently holds a Pro early-adopter grant, so a "free" token needs a test account with that grant removed (do this in a scratch account, not by editing real users).
- No frontend change is live yet, so this step is invisible to users.

# Phase 4 — Frontend switch (F)

Order matters: types and contract first, then the client, then the components, then deletion. Each step keeps `npm test` green.

## F1. Wire types

- [ ] Add `TrailConditionResponse` (contract above) to `app/types/Weather.ts`. Keep `ConditionLevel`. Do not yet delete `SpotWeather`/`DayWeather` etc.; they go in F6.

## F2. Communication layer, test-first

Rewrite `app/communication/weather.test.ts` first (mock `fetch` at the HTTP boundary):

- [ ] 200 with a valid body → returns the view-model.
- [ ] 401, 403, 404, 502, network error, malformed JSON → returns `null`, never throws.
- [ ] Request goes to `` `${FUNCTIONS}/trail-condition` `` as `POST`, JSON `{ spotType, spotId }`, with `userHeaders(token)`. No latitude or longitude in the body.
- [ ] localStorage cache (`tr_wx_v2_<type>_<id>`, 1 h TTL): fresh entry returns without `fetch`; expired entry refetches; corrupt entry is dropped; missing `localStorage` (prerender) and throwing `localStorage` are tolerated.
- [ ] A 403 also clears any cached entry for that spot, so a downgraded user does not keep seeing a stale paid card.

Then implement:

- [ ] Replace `app/communication/weather.ts` with `fetchTrailCondition(spotType, spotId, accessToken)`. Remove `buildWeatherUrl`, `mapWeatherResponse`, `PAST_DAYS`, `FORECAST_DAYS`, `weatherCacheKey` (rounded coordinates). Import `FUNCTIONS`, `userHeaders` from `./http.ts`.
- [ ] Where does the access token come from? `communication/` must not import stores, so the composable passes it in. Check how `stores/subscription.ts` and `stores/auth.ts` expose the session token and follow the same route the SpotManager API uses.
- [ ] Commit.

## F3. Composable

- [ ] Update the `useSpotWeather` test (rename to `useTrailCondition` if the rename is small; otherwise keep the name and change the signature). Cases: no request when the source getter returns `null`; request once when it returns a spot; never runs during SSR (`onMounted` guard kept, with its comment about `nuxt generate`).
- [ ] Change it to accept `() => { spotType; spotId } | null` and return `{ condition, loading }` where `condition` is a `TrailConditionResponse | null`.
- [ ] Commit.

## F4. Components, test-first

- [ ] `SpotDetailWeather.test.ts`: change fixtures from `SpotWeather` to `TrailConditionResponse`. Assert the same rendered text/classes as today for each level (`prime`, `wet` shows the "Trails schonen" care note, `hard` has no colour class, `unknown` renders nothing), skeleton while `loading`, `weather-sample` test id with no Open-Meteo credit when `sample`. Tests must fail against the old component.
- [ ] `SpotDetailWeather.vue`: props become `{ condition: TrailConditionResponse | null; loading?: boolean; sample?: boolean }`. Remove `computeTrailCondition`, `conditionModeFor`, `todayIndex`, `weatherCodeIcon` imports. The strip maps `strip[]` to the existing view (`label: isToday ? 'Heute' : weekday`, bar height/class from `precipitationMm`). Keep `LEVEL_STYLE`, `formatMm`, `barHeight`, `barClass`.
- [ ] `SpotDetailStatus.test.ts`: rain rule from `rainRule` — "es regnet gerade" / "aktuell kein Regen" (`during`), "Regen vor N h — Regel greift" / "letzter Regen vor N h" / "seit Tagen kein Regen" (`after`, including `hoursSinceRain === null`), nothing when no rule or no condition. Then change `SpotDetailStatus.vue` to take `condition?: TrailConditionResponse | null` and use `condition.rainRule`; remove the `hoursSinceLastRain` import.
- [ ] `app/utils/sampleCondition.ts` (replaces `sampleWeather.ts`): `sampleTrailCondition(now)` returns a "Hero Dirt" (`prime`) `TrailConditionResponse` with the 6 strip days relative to `now`, same look as today's sample (rain 5 days ago, showers two days ahead). Write `sampleCondition.test.ts` first: strip dates are today−2…today+3, exactly one `isToday`, `level` is `prime`, and the object is typed as `TrailConditionResponse` (compile-time check keeps it in step with the real card).
- [ ] `SpotDetailWeatherLocked.vue` + test: render `SpotDetailWeather` with `sampleTrailCondition(new Date())` and `sample`, still aria-hidden and inert, still no request.
- [ ] Commit.

## F5. Page wiring

- [ ] `app/pages/trails/[slug].vue`: replace the `useSpotWeather` call with the new composable, passing `{ spotType: trailForStore.value.type, spotId: trailForStore.value.id }` only when `conditionAccess === 'allowed'`. Pass `condition` to `SpotDetailWeather` and to `SpotDetailStatus` (still `null` unless allowed). Update the surrounding comment: the gate is now enforced by the function; the client check only decides what to render.
- [ ] A `403` from the function while the client believes it is allowed (stale entitlement) should show the locked teaser, not an empty gap. Test in `tests/trails-detail-page.spec.ts` or a component test: mocked 403 → teaser.
- [ ] Update `tests/fixtures.ts`: replace the Open-Meteo route mock with a mock of `**/functions/v1/trail-condition` returning a `TrailConditionResponse`. Update `tests/trails-detail-page.spec.ts` and `tests/profile.spec.ts` accordingly.
- [ ] Commit.

## F6. Delete the client model

- [ ] Delete: `app/utils/trailCondition.ts` + `.test.ts`, `app/utils/weatherCodes.ts`, `app/utils/sampleWeather.ts` + `.test.ts`, `app/utils/__fixtures__/`, `scripts/soil-backtest/` (moved in B5), `soil-backtest` script entry in `package.json`, and now-unused types (`SpotWeather`, `DayWeather`, `CurrentWeather`, `HourlyWeather`, `TrailCondition`) from `app/types/Weather.ts`.
- [ ] Update `vitest.config.ts` and `playwright.config.ts` if they referenced the soil-backtest tests or the removed fixtures.
- [ ] Add to `app/architecture.test.ts` (replacing any assertion about the old layout, not just deleting it): no file under `app/` imports `trailCondition`, `weatherCodes`, or contains `api.open-meteo.com`/`open-meteo.com/v1`. The Open-Meteo credit link in the card (`https://open-meteo.com/`) is a plain attribution link, so the check must target API URLs, not the bare domain.
- [ ] Run `npm run lint:arch`.
- [ ] Commit.

## F7. Docs and memory

- [ ] `app/entitlements/features.ts`: rewrite the `trail_condition` comment — enforced server-side by `trail-condition` (`REQUIRED_LEVEL` must equal `minLevel`); remaining caveat is only the Open-Meteo commercial licence. Add a test that fails if the two levels disagree if a cheap way exists (e.g. a shared constant asserted in both repos' tests); otherwise leave the paired comments.
- [ ] `CLAUDE.md`: under Supabase rules add "Paid features are gated by an edge function that calls `has_min_tier(level)` as the caller; never by the client alone. Example: `trail-condition` in `trailradar-backend`." Update the "Key files" table if it mentions the deleted files.
- [ ] Update memory `project_trail_condition_paywall.md`: server-side enforcement done, model and backtest now live in `trailradar-backend`, the remaining item is the commercial licence.
- [ ] Commit.

# Phase 5 — Verify and ship

- [ ] F: `npm test` (all unit + architecture tests), `npm run lint:arch`, `npm run test:e2e` (touches the trail detail page and auth-dependent flows).
- [ ] B: `deno test` all green, including the moved model tests.
- [ ] Manual, in a browser against local or production functions (use the `run` skill): logged out → teaser and no `trail-condition` request in the network tab; free test account → teaser; Plus/Pro account → real card, strip with 2 past + today + 3 ahead, status banner rain line for a spot with a rain rule; offline (devtools) after one visit → last cached card; 403 path.
- [ ] Mobile check at a small viewport: the card layout is unchanged, so this is a regression check only.
- [ ] `npm run verify:static-build` per CLAUDE.md, since the spot page's data fetching changed: confirm the prerendered page contains the skeleton, no weather, and no model.
- [ ] Inspect the built client bundle (`.output/public/_nuxt`) for model constants (`RUNOFF_FRACTION`, `DRYING_FACTOR`, "Hero Dirt" logic strings other than the static sample). Only the sample's fixed strings may remain.
- [ ] Deploy order: backend already live from B7 → merge the F branch (the user merges; not Claude) → confirm production spot page.

## Risks and watch-outs

- **Entitlement drift**: `REQUIRED_LEVEL` in B and `minLevel` in F are two copies of one number. Paired comments plus a test on each side; revisit if more gated functions appear (then move required levels into a table).
- **Cold-start latency**: first call per spot per hour pays an Open-Meteo round trip. The card already has a skeleton; measure in step B7 and add pre-warming only if it is noticeably slow.
- **Concurrent cache misses** can double-fetch. Accepted in the spec.
- **`verify_jwt = true`** blocks anonymous callers at the platform. That is intended, but the 401 path the tests cover must also be checked live in B6, since the platform may answer before the handler does.
- **Model in git history**: already public in F's history; this plan does not rewrite history. Constants review is a separate follow-up.
- **Open-Meteo licence**: still required before the first payment. Everything is now funnelled through one server-side key, so activating it is a secret change, not a code change.
