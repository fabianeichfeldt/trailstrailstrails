# Trail-Zustand behind an edge function — design

Date: 2026-09-24
Status: draft, awaiting review
Repos: `trailstrailstrails` (frontend), `../trailradar-backend` (Supabase edge functions)
Builds on: branch `worktree-feat+spot-weather` (Trail-Zustand, `FEATURES.trail_condition`, Plus and up) and the subscription entitlements spec (`2026-09-23-subscription-entitlements-design.md`).

## Problem

Trail-Zustand is the first paid feature, but everything runs in the browser:

- The browser calls Open-Meteo directly (`app/communication/weather.ts`).
- The water-balance model (`app/utils/trailCondition.ts`, thresholds, `RUNOFF_FRACTION`, `DRYING_FACTOR`) ships in the client bundle.
- The gate (`useFeatureAccess('trail_condition')`) is UI-only. Anyone can call Open-Meteo themselves, read the model from the bundle, or flip the entitlement in devtools.

The entitlement spec calls a frontend-only gate a bug. It is acceptable only while every user holds a free Pro grant and there is no checkout. This design closes it.

## Goals

- The model and its tuning constants no longer ship to the browser.
- The entitlement is enforced server-side, so it cannot be hijacked from the client.
- Open-Meteo is called from one place with one key, which also settles the commercial-licence question.
- Adding soil properties later requires no client change.

## Non-goals

- Building the SoilGrids lookup or changing model behaviour. This is a lift-and-shift of the current weather verdict. The design only leaves room for soil inputs.
- A billing or checkout flow.
- Removing the model from already-published git history of the frontend repo.
- Retuning or renaming the model constants (possible follow-up if the constants are considered sensitive).

## Decisions

| Question | Decision |
|---|---|
| Response shape | Finished view-model: verdict, strip, current conditions. No raw weather, no thresholds. |
| Scope | Weather verdict only, structured so soil parameters can be added inside the function later. |
| Request input | `{ spotType, spotId }`. The function looks up coordinates and surface itself. |
| Locked teaser | Static view-model constant in the client. No request, no model in the bundle. |
| Upstream limiting | Postgres cache table per spot, 1 hour TTL, lazily refreshed. |
| Model home | Model, tests, fixtures and soil backtest move to the backend repo. |

## Architecture

```
browser (Plus+)                       edge function `trail-condition`                 upstream
useSpotWeather ── POST {spotType,spotId} + JWT ──▶ verify JWT
                                                   has_min_tier(1) as the caller ── 401 / 403
                                                   load spot coords + surface (service role)
                                                   weather_cache hit? ── no ──▶ Open-Meteo (keyed)
                                                   computeTrailCondition(payload, mode, now)
◀────────────────── view-model JSON ───────────────┘
```

### 1. Edge function `trail-condition` (backend repo)

`supabase/functions/trail-condition/` with `index.ts` and `cors.ts`, following the `add-visit` / `report` pattern: `OPTIONS` first, `getCorsHeaders(req)` on every response, `https://trailradar.org` as the allowed origin. Register a `[functions.trail-condition]` block in `supabase/config.toml`.

Flow:

1. Method must be `POST` with JSON. Otherwise 405 or 400.
2. Validate `spotType` (`trail | bikepark | dirtpark`) and `spotId`. Otherwise 400.
3. Build a Supabase client from the caller's `Authorization` header. No JWT means 401.
4. Call `has_min_tier(required_level)` as that user, with the required level taken from a constant in the function (1). Not entitled means 403. The function reuses the existing SQL entitlement logic; there is no second definition of tiers. The level constant duplicates `FEATURES.trail_condition.minLevel` in the frontend, and the two are kept in sync by a comment plus a test on each side.
5. With the service role, load the spot's latitude, longitude and surface. Unknown spot means 404. The mapping from spot type to table and surface uses a dispatch table keyed by `spotType`, not an if chain (Open/Closed, as in CLAUDE.md).
6. Get the weather payload from the cache or Open-Meteo (section 3).
7. Run the model with `now` from the server clock and return the view-model.

The service role key is used only for the spot lookup and the cache table. The entitlement check always runs as the caller.

### 2. Model and backtest move to the backend repo

Move from the frontend worktree to `trailradar-backend`:

- `app/utils/trailCondition.ts` and its test to `supabase/functions/_shared/trailCondition.ts`
- `app/utils/weatherCodes.ts` (label and icon-key mapping, server-side)
- `app/utils/__fixtures__/*.json` fixtures
- `scripts/soil-backtest/**` (with its fixtures and results), so the backtest imports the single shared copy

The module stays pure (no fetch, no `Date.now()` except via an injected `now`). `conditionModeFor` currently takes a frontend `Trail`. The backend version takes the surface facts loaded in step 5 (for a dirtpark: `pumptrack` and `dirtpark` flags). The asphalt-only rule is unchanged.

The frontend keeps only the view-model types and the renderer. `sampleWeather.ts` and `useSpotWeather` are reworked as in section 5.

Soil readiness: the model function gets an optional `soil` parameter object, unused for now. When SoilGrids data is added, the function looks it up per spot and passes it in. The view-model does not change.

### 3. Weather cache

New migration in the backend repo (`supabase/migrations/`, the first one there; the backend README and CLAUDE.md note that schema changes have so far been applied directly, so this also needs a line on how it gets applied):

```sql
CREATE TABLE public.weather_cache (
  spot_type  text        NOT NULL,
  spot_id    text        NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  payload    jsonb       NOT NULL,
  PRIMARY KEY (spot_type, spot_id)
);
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (which bypasses RLS) can read or write.
```

`spot_id` is `text` to cover whatever key type the three spot tables use; the implementation plan confirms the real types before the migration is written.

Behaviour:

- Entry younger than 1 hour is served as is.
- Older or missing entry triggers an Open-Meteo call, then an upsert.
- Upstream failure with a stale entry serves the stale entry. Upstream failure with no entry returns 502.
- Concurrent misses may both fetch. This is harmless and not worth locking.
- The cache stores the raw normalised upstream payload, not the verdict, so the model's "now" is always current and a model tweak needs no cache flush.
- Cache key is per spot, not per rounded coordinate. Spots sharing a grid cell cost a few extra calls; simplicity wins.

Open-Meteo access moves into the function (same parameters as today: 10 past days, 4 forecast days, the same hourly and daily variables). The commercial API key is read from a function secret (`OPEN_METEO_API_KEY`), and the commercial base URL is used when it is set. Without it, the free endpoint is used, which is fine in dev and stays non-commercial.

### 4. View-model (the wire contract)

Defined in the frontend `app/types/Weather.ts` and mirrored in the backend. Nothing else crosses the wire.

```ts
interface TrailConditionResponse {
  verdict: {
    level: ConditionLevel        // dusty | prime | damp | wet | raining | snow | hard | unknown
    headline: string
    detail: string
    rain10dMm: number
    hoursSinceRain: number | null  // also drives the status banner's rain-rule line
  }
  current: { temperature: number; apparentTemperature: number; label: string; iconKey: string; windKmh: number }
  strip: Array<{ date: string; iconKey: string; tempMax: number; tempMin: number; precipitationMm: number; isToday: boolean; isForecast: boolean }>
  fetchedAt: string
}
```

Not included: hourly arrays, evapotranspiration, snowfall series, thresholds, the water-balance figure. The renderer needs only what it displays. If the card currently shows `wetnessMm`, the plan checks that and either keeps it or drops it deliberately.

### 5. Frontend changes

- `app/communication/weather.ts`: replaced by a thin call to the function using `FUNCTIONS` and `userHeaders(token)` from `http.ts`. No Open-Meteo URL, no `mapWeatherResponse`, no `PAST_DAYS`/`FORECAST_DAYS`. Never throws: any failure returns `null`, so the card degrades to "no card" as today.
- `useSpotWeather`: still client-only inside `onMounted`. Baking the value at `nuxt generate` time would freeze the build day's weather. It takes `{ spotType, spotId }` instead of coordinates.
- Gating: `useFeatureAccess('trail_condition')` stays and decides what to render and whether to call at all. It is now purely UX; the function is the real gate. A 403 renders the locked teaser.
- `SpotDetailWeather.vue`: renders the view-model directly. It no longer calls `computeTrailCondition`, `conditionModeFor` or `todayIndex`.
- `SpotDetailStatus.vue`: reads `hoursSinceRain` from the view-model instead of computing it from weather data.
- `SpotDetailWeatherLocked.vue`: renders the same card with a static view-model constant ("Hero Dirt", dates generated relative to today, aria-hidden and inert as now). It makes no request. A test types the constant against `TrailConditionResponse` so it cannot drift from the real card.
- Per-device cache: a localStorage cache of the view-model with a 1 hour TTL (new key prefix, e.g. `tr_wx_v2_`) keeps the offline PWA showing the last known card and spares the function repeat calls. Same try/catch and prerender guards as today.
- Deleted: `app/utils/trailCondition.ts`, `weatherCodes.ts`, `sampleWeather.ts`, the old `fetchSpotWeather` internals, their tests and the `__fixtures__` that moved.
- Comments and docs updated: the `FEATURES.trail_condition` comment (no longer a UI-only gate), `CLAUDE.md` (new bullet under Supabase rules: gated features go through an edge function checking `has_min_tier`), and the `project_trail_condition_paywall` memory.

### 6. Error handling

| Situation | Function | Client |
|---|---|---|
| No or invalid JWT | 401 | locked or sign-in state |
| Below Plus | 403 | locked teaser |
| Bad request body | 400 | no card |
| Unknown spot | 404 | no card |
| Upstream down, cache exists | 200 with stale payload | normal card |
| Upstream down, no cache | 502 | no card |
| Incomplete upstream payload | model returns `level: 'unknown'` | no card |
| Network failure or offline | n/a | last cached card, else no card |

The card is advisory. No failure path may break the spot page.

### 7. Testing

Backend (Deno):

- The moved model tests and fixtures pass unchanged in behaviour.
- Function tests with mocked Open-Meteo and a stubbed entitlement check: 401, 403, 400, 404, 200; cache hit, miss and stale-on-error.
- A test that the response contains no key outside the view-model contract, so raw data cannot leak by accident.

Frontend (vitest, network mocked at the HTTP boundary; tests never touch the production database, with a placeholder `SUPABASE_URL`):

- `communication/weather` returns a view-model on 200 and `null` on 401, 403, 5xx and network errors.
- `useSpotWeather` makes no request for a locked or logged-out user.
- Teaser constant type-checks against the wire type and renders through the real card component.
- `SpotDetailStatus` rain line from `hoursSinceRain`.
- Architecture test in `app/architecture.test.ts`: fails if the client imports the model, `weatherCodes` or an Open-Meteo URL. This replaces the current assertions about the old layout, per the CLAUDE.md rule to update rather than delete.
- Playwright: free user sees the teaser and makes no function call; Plus user gets a card from a mocked function response.

### 8. Rollout order

1. Confirm spot table key types; write and apply the `weather_cache` migration.
2. Move the model, fixtures and backtest to the backend repo; get the backend tests green.
3. Write and deploy the `trail-condition` function (secret `OPEN_METEO_API_KEY` optional at first).
4. Switch the frontend to the view-model and thin client; delete the client model.
5. Update `CLAUDE.md`, the `FEATURES` comment and the memory note.

Steps 2 and 3 can ship before step 4 with no user-visible change. The old client path keeps working until step 4 lands, so there is a safe point to roll back to.

## Open items for the implementation plan

- Real key types of `trails`, bike parks and dirt parks, and where each stores latitude, longitude and the surface flags.
- Whether the card needs `wetnessMm` or the current water-balance figure, or only the verdict text (decides one field in the view-model).
- How backend migrations get applied, given none exist yet.
- Open-Meteo commercial licence and key: needed before the first payment, not for this work to ship.
- Whether the tuning constants should be reviewed for sensitivity before the model is treated as protected.
