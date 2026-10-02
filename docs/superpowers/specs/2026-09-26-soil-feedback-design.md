# Soil-Condition Rider Feedback — Design Spec

**Date:** 2026-09-26 (revised same day after reading the backend)
**Status:** Approved in brainstorming except the revised §3–§4, pending confirmation
**Repos:** `trailstrailstrails` (frontend), `../trailradar-backend` (edge functions, migrations)
**Builds on:** frontend branch `worktree-feat+spot-weather` (unmerged at time of writing) and the merged/deployed backend `trail-condition` function. The frontend work must branch off `worktree-feat+spot-weather`, not `main`.

## Purpose

Collect rider feedback on actual trail conditions as **training/validation data** for the soil-condition model. The model's verdict (`dusty` / `prime` / `damp` / `wet`) is a single level, but real trails vary within one spot (sun exposure, canopy, aspect). Feedback therefore captures a **range** on the condition scale ("prime to damp"), not a single label. The model constants (`RUNOFF_FRACTION`, `DRYING_FACTOR`, thresholds) are explicitly fitted against few observations; this data is the ground truth they are waiting for.

## Scope decisions

- **Training only.** Reports are never shown to other users. No crowd display, no moderation surface. (A public "3 riders reported damp" signal is a possible later step; the data model does not preclude it.)
- **Pre-filled, not blind.** The sheet shows the model's range as the starting point and the rider corrects it. This maximises participation and minimises friction, at the price of anchoring. Mitigations: every report stores the model snapshot and whether the rider changed it, so training can down-weight unchanged confirmations; "Stimmt so" is an explicit tap, never implied by opening the sheet.
- **Registered users only**, tied to the account for spam control and per-user weighting. Anonymous users get the login flow. In practice the entry point lives inside the Trail-Zustand card, which is already entitlement-gated in the UI; the feedback endpoint itself requires only a valid login.
- **Spot-level, range only (v1).** One report = one spot + one range + one observation time. No per-trail reports. No "where is it wetter?" UI in v1, but the column is reserved.
- **Four segments = the model's four soil levels**, so reports compare 1:1 with model output and the backtest.
- **Model snapshot is computed server-side.** The client sends only what the rider chose. This keeps the model in the backend (the whole point of moving it there), makes the snapshot trustworthy, and lets a report for a past ride be compared against the model's view *of that time*.
- **Fixed-width range for now.** The model returns a single level; the range is derived by perturbing the model's own balance by a fixed ±30 % (see §3). Exposure features replace this later; `model_version` distinguishes the two.

## 1. User flow

### Entry point: on the scale itself

The Trail-Zustand card gains a read-only **four-segment scale** (dusty · prime · damp · wet) with the model's range highlighted, labelled "Unsere Schätzung". Directly beneath it sits a text link:

> **Du bist gerade hier gefahren und weißt es besser?**

Tapping it opens the feedback sheet. The link is shown only when the card shows a real soil verdict with a range: not for `unknown`, `hard`, `snow` or `raining` levels, and **not in the locked/teaser state** of the paywall card. Logged-out users are sent to the existing login flow instead of the sheet.

### Sheet (bottom sheet on mobile, dialog on desktop)

1. **Scale**, same four segments, pre-filled with the model range for the selected time.
   - Tap a segment: selects it alone.
   - Tap another segment: extends the range to include it.
   - Tap the only-selected segment again: resets to the model range.
2. **When did you ride?** A `datetime-local` picker, default *now*, `max` = now, `min` = now − 3 days. (The backend weather cache holds 10 past days and the model's balance window is 10 days; three days back keeps at least seven days of history behind the ride, so the snapshot stays meaningful.) Changing it re-fetches the model range for that moment (§3.1, `at`), debounced; the scale shows a small loading state meanwhile and the submit button is disabled until it resolves.
3. **Optional toggles** outside the scale: `Schnee/Frost`, `Regen`. These are not points on the dry-to-wet axis.
4. **Action button:** "Stimmt so" while the range equals the model range and no toggle is set; "Senden" after any change.
5. **Result:** short thank-you and the sheet closes. On failure the sheet stays open, keeps the selection and shows a retry message.

### Duplicates

One report per user, per spot, per **spot-local calendar day of the ride**. A second submission for the same day replaces the first.

## 2. Data

Migration in the **backend repo**: `supabase/migrations/<timestamp>_add_soil_reports.sql` (next to `weather_cache`; how backend migrations get applied is still an open README item and unchanged by this work).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | default `gen_random_uuid()` |
| `created_at` | timestamptz | default `now()` |
| `user_id` | uuid not null | from the verified JWT, references `auth.users` on delete cascade |
| `spot_type` | text not null | `trail` / `bikepark` / `dirtpark` |
| `spot_id` | text not null | text, confirmed |
| `observed_at` | timestamptz not null | ride time (from the picker) |
| `observed_date` | date not null | spot-local calendar date of `observed_at`, computed server-side |
| `range_lo`, `range_hi` | smallint not null | 0–3 (dusty…wet); check `0 <= range_lo <= range_hi <= 3` |
| `model_lo`, `model_hi` | smallint not null | model range at `observed_at` |
| `model_level` | text not null | model verdict at `observed_at` |
| `model_surplus_mm`, `model_drying_mm` | real not null | the two balance inputs to `levelFromBalance` at `observed_at` |
| `model_version` | text not null | e.g. `band30-v1` |
| `model_params` | jsonb not null | `{ runoffFraction, dryingFactor, thresholdPrimeMm, thresholdDampMm, thresholdDustDryingMm }` at submit time, so retuning the constants later does not orphan old rows |
| `adjusted` | boolean not null | true iff `(range_lo, range_hi)` differs from `(model_lo, model_hi)`; computed server-side |
| `flags` | text[] not null default `'{}'` | subset of `snow`, `frozen`, `raining` (check constraint) |
| `where_wetter` | text[] null | reserved, unused in v1 |

`unique (user_id, spot_type, spot_id, observed_date)`.

### Access

RLS **enabled with no policies**, the same pattern as `weather_cache`: only `service_role` reads or writes. All writes go through the edge function (§3.2); no client ever touches the table with the anon key. This removes the RLS surface CLAUDE.md warns about and means `user_id` can never be forged. The trained data is read by the operator via the service role or SQL editor. (Frontend `database.types.ts` does not need to change, since the frontend never queries this table.)

## 3. Backend (`trailradar-backend`)

### 3.1 Model range

- **`_shared/trailCondition.ts`** — new pure `computeConditionRange(balance)`. `levelFromBalance` is not a function of `wetnessMm` alone (dusty depends on evaporation since the last rain), so the range perturbs both inputs the same way the model uses them:
  - `lo = levelFromBalance({ surplus × 0.7, dryingSinceRain × 1.3 })`
  - `hi = levelFromBalance({ surplus × 1.3, dryingSinceRain × 0.7 })`
  - each mapped to an index 0–3 (dusty…wet). Export `SOIL_RANGE_BAND = 0.3` and `MODEL_VERSION = 'band30-v1'`.
  The implementer must first check that `Balance` exposes `surplusMm` and `dryingSinceRainMm` (both are read by `levelFromBalance`) and export what is needed without leaking constants to the wire.
- `TrailCondition` gains `range: { lo: number; hi: number } | null` (null for `raining`, `snow`, `hard`, `unknown`); `computeTrailCondition` fills it.
- `TrailConditionResponse.verdict` gains `range` (same nullable shape). **Mirror in the frontend `app/types/Weather.ts`**; the response shape is the wire contract.
- **`trail-condition` gets an optional `at` (ISO string)** in the request body. Validation: must parse, must not be in the future, must be no older than 3 days; otherwise 400. When present, only the *verdict* is computed with `now = at`; `strip`, `current`, `rainRule` and `fetchedAt` stay at the real now. Entitlement, cache and CORS behaviour are unchanged. Absent `at` behaves exactly as today (existing tests must stay green).

### 3.2 New edge function `soil-report`

`supabase/functions/soil-report/{index.ts, handler.ts, cors.ts}` plus a `[functions.soil-report]` block in `supabase/config.toml`, following the `trail-condition` split: `handler.ts` is a pure function of injected deps (tested without network), `index.ts` wires the real ones. It reuses `loadSpot`, the weather cache and `fetchOpenMeteo`.

Request: `POST { spotType, spotId, observedAt, rangeLo, rangeHi, flags }` with the user's JWT.

Flow:
1. `OPTIONS` first; `getCorsHeaders(req)` on every response. **`cors.ts` must allow localhost dev origins as well as `https://trailradar.org`**, or the feature silently never shows in dev.
2. Verify the JWT (`getUser`); no user → 401.
3. Validate: `spotType` in the allowed set, `spotId` non-empty, `observedAt` within `[now − 3 d, now]`, `0 <= rangeLo <= rangeHi <= 3` integers, `flags` a subset of the allowed set. Otherwise 400.
4. Load the spot (service role); unknown → 404. Get weather from cache or Open-Meteo (same stale-on-error rule as `trail-condition`).
5. `computeTrailCondition(weather, conditionModeFor(surface), observedAt)`. If the result has no range (raining / snow / hard / unknown at that time), return 422 with `{ error: 'no_soil_verdict' }`: there is nothing to compare against.
6. Compute `observed_date` with `spotLocalDate(weather, observedAt)` and `adjusted` by comparing ranges.
7. Upsert on the unique key with the service role; return `{ ok: true }`.

The client never sends `user_id`, `observed_date`, `adjusted` or any `model_*` value; if present they are ignored.

## 4. Frontend (branch off `worktree-feat+spot-weather`)

Layers per CLAUDE.md, bottom up. File names for the existing trail-condition fetch/composable/card are as found on that branch; the implementer confirms them first.

- **`app/types/Weather.ts`** — add `ConditionRange` and `range` on the verdict.
- **`app/communication/`** — the existing trail-condition fetch gains an optional `at` argument. New `soilReports.ts`: `submitSoilReport(report, token): Promise<{ ok: boolean }>`, POST to the `soil-report` function via `FUNCTIONS` and `userHeaders(token)` from `http.ts`. Never throws.
- **`app/utils/soilFeedback.ts`** — pure `nextRange(current, tappedIndex)` (tap/extend/reset rules).
- **`app/composables/useSoilFeedback.ts`** — submit state (`idle | sending | done | error`), the token from the shared `stores/auth.ts` (no second auth state), and the debounced `at` refetch for the picker.
- **`app/components/trail_detail/ConditionScale.vue`** — the four-segment scale, shared by the card (read-only) and the sheet (interactive).
- **`app/components/trail_detail/SoilFeedbackSheet.vue`** — the sheet.
- The Trail-Zustand card component — renders the scale and the entry link under the rules in §1.

## 5. Errors, mobile, tests

### Errors and edge cases

- **Offline / failed request:** sheet stays open, selection kept, retry message. An offline queue is out of scope.
- **Expired session mid-submit:** treated as a failed request.
- **422 `no_soil_verdict`:** the model had no soil verdict at the chosen time (e.g. it was raining then); the sheet shows "Für diesen Zeitpunkt haben wir keine Schätzung" and disables submit.
- **Picker outside the window:** prevented by `min`/`max`; the server enforces the same bounds.

### Mobile

- Segments at least 44 px tall; the sheet has a close button and backdrop-tap dismissal.
- No new page, so the back-navigation rule does not apply.
- Verify the `datetime-local` picker on iOS Safari and in the installed PWA.

### Tests

**Backend (`npm test`, deno; no network, no production Supabase):**
- `computeConditionRange` at every threshold boundary, on the dust side (drying) and the wet side, and null for override levels.
- `trail-condition` with `at`: past time shifts only the verdict; future / too-old / unparsable `at` → 400; no `at` → existing behaviour.
- `soil-report` handler with fake deps: 401 without user; 400 on each invalid field; 404 unknown spot; 422 when no soil verdict; client-supplied `user_id` / `model_*` / `adjusted` ignored; server-computed `adjusted` and `observed_date`; second same-day submit results in one upsert call on the unique key; response contains no model internals.

**Frontend (vitest, `SUPABASE_URL=http://localhost:54321`):**
- `nextRange` for every tap combination.
- Symptom test: mount the sheet with the network mocked at the HTTP boundary, tap segments, submit; assert the POST goes to `soil-report` with exactly `{ spotType, spotId, observedAt, rangeLo, rangeHi, flags }` and no `model_*`, `adjusted` or `user_id`.
- Symptom test: changing the picker triggers a trail-condition request with `at`, and the pre-filled range follows the response; submit is disabled while it is pending.
- Symptom test: the link is absent in locked-teaser state and for `snow` / `raining` / `hard` / `unknown`.
- Architecture: `soilReports.ts` uses `FUNCTIONS`, no hardcoded URL, no forbidden imports.

**Manual checklist:** anon key cannot select or insert into `soil_reports`; a real end-to-end report from the deployed function shows one row with a sensible snapshot; the picker on iOS Safari.

No Playwright: nothing needs real browser behaviour beyond the picker check.

## Rollout order

1. Backend: migration, `computeConditionRange`, `at` on `trail-condition`, `soil-report`. Apply the migration and deploy both functions.
2. Frontend: everything in §4, on top of `worktree-feat+spot-weather`; merges after that branch.

The frontend is inert without the backend (no `range` in the response → no link), so the order is safe in both directions.

## Out of scope for v1

- Public/crowd display of reports.
- `where_wetter` UI (column reserved).
- Per-trail reports; post-ride notifications.
- Exposure-based ranges (fixed ±30 % band until then).
- Offline submission queue.
- The training pipeline that consumes the data.
