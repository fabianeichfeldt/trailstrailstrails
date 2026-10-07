# Boden-Radar — soil-state map layer (Supporter feature)

**Date:** 2026-10-07
**Status:** design approved, not implemented
**Repos:** `trailstrailstrails` (client), `trailradar-backend` (snapshot + gated endpoint)

## Goal

A map layer that answers "where is the dirt good right now?" at a glance, for all
spots at once. It reuses the existing water-balance verdict that powers the
Trail-Zustand card, and is unlocked for the Supporter plan (level 1). The UX must
feel premium: a radar-sweep activation, soft glow on Hero Dirt, a filter that is
also the legend.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Core concept | **Soil radar (B1 "spot clouds")**: colour grows out of each real spot with a **20 km** radius and fades to nothing between spots. No interpolation over land without spots. |
| Time | **Current state only.** No forecast slider. |
| Filter | **F1 — the legend is the filter**: the colour ramp is a two-handle range slider. |
| Pins | **M2 — soil badge**: existing type-coloured pin unchanged, plus a round soil badge with glyph on its shoulder. |
| Look | **L1 Earth** on the existing light/grey map, multiply blend; soft green glow on Hero Dirt. Activation = one radar-beam sweep + staggered badge pop-in. |
| Free users | **Locked button + sample demo** on the real map ("Beispielansicht"), then a sheet. Never real data. |
| `hard` verdict | **Removed everywhere.** Pumptracks are not assumed to be asphalt; every spot gets a soil verdict (spot card included). |
| Data | **Precomputed snapshot**, refreshed at **06, 09, 12, 15, 18 Europe/Berlin**. |

Reference mockups (chosen variants, open directly in a browser — they are
self-contained fragments, styles inline): `2026-10-07-soil-radar-mockups/`.
They carry the draft palette, glyph SVGs, sweep CSS and the cloud maths.

## 1. Experience

### Entry point
A round **radar button** joins the floating-button stack next to the location
button (`app/pages/map.vue`). Visible to everyone.
- Free / logged out: small lock overlay.
- Supporter, layer off: neutral. Layer on: green ring + glow.
- Entitlement `checking`: neutral, tap is queued until resolved (a Supporter
  never sees a locked flash).

### Activation (Supporter)
1. Data from cache or `soil-map`.
2. A radar beam sweeps once (≈1.6 s) around the viewport centre, revealing the
   soil clouds behind it.
3. Soil badges pop onto pins in the order the beam passes them (delay =
   angle from centre).
4. The glass bottom panel slides up.

Deactivation: clouds fade, badges scale out (≈250 ms). With
`prefers-reduced-motion`: no sweep / pop / pulse, plain fade.

### Clouds
- Each spot with a soil verdict emits a Gaussian with σ derived from 20 km
  (ground distance, so clouds scale with zoom).
- Colour = weight-averaged level on a continuous ramp; alpha = accumulated
  weight (capped), so spot-less land stays plain map.
- Palette (L1 Earth, draft values — final tuning during implementation):
  `staubig #e0a526 → trocken #8bbf3f → Hero #16c060 → feucht #2ea8e6 → Matsch #6d4c41`.
- Level mapping onto the 0–4 axis: `dusty 0, dry 1, prime 2, damp 3, wet 4`;
  `raining → 3` (colour feucht); `snow → 4` but rendered with a white frost
  tint; `unknown` / missing → no cloud.
- Cloud opacity is 1 up to zoom 8, then fades linearly to a floor of 0.1 at zoom 14 and stays there — the clouds never vanish completely, they just get fainter the closer you zoom in.

### Pins (M2)
- Pin unchanged (`markerIconOptions`), badge 17 px circle, 2 px white border,
  white SVG glyph: dusty = wind lines, dry = sun, prime = star, damp/raining =
  drop (raining: rain glyph), wet = mud waves, snow = snowflake.
- Hero Dirt badge: soft green glow, slow breathe (2.4 s).
- **Clusters**: conic-gradient donut of the soil-level shares of their children,
  count in the middle; green glow if any child is Hero Dirt.
- **GPX view (zoom ≥ 11)**: markers are hidden there today; each spot instead
  gets one soil chip (same badge) at its coordinates.
- While the layer is on, the marker pane's `grayscale(0.2)` is switched off so
  badge colours and glow stay true.

### Filter panel (F1)
Glass bottom panel (`backdrop-filter: blur`), thumb-reachable:
- Colour ramp as a two-handle range slider, handles ≥ 44 px touch target,
  glyph + label ticks underneath (staubig · trocken · Hero · feucht · Matsch).
- Outside the range: pins fade to ghosts (opacity ≈0.2, greyscale, scale 0.7),
  their clouds disappear; live while dragging.
- Counter chip top-left: "21 von 46 Spots" (spots in viewport matching).
- Freshness line: "Stand 15:00"; offline: "Stand Mo 18:00 · offline";
  older than 24 h: amber "Daten veraltet".
- Range semantics: inclusive; spots without a verdict match only when the range
  is the full 0–4.

### Free users (sample demo)
- Tap on locked button → same activation sequence over a **fixed sample scene**
  (hard-coded fake spots/verdicts placed around the current viewport, not real
  spot positions) with a persistent "Beispielansicht" pill.
- Then `SoilRadarLockedSheet` opens:
  - logged out + `isSignupPromoActive()`: "Für begrenzte Zeit kostenlos — jetzt
    registrieren" → `mapStore.authModalOpen = true`.
  - logged in, locked: "Boden-Radar ist eine Supporter-Funktion" + link to
    `/supporter`.
- Closing the sheet turns the sample off. Sample mode never fetches, never writes
  cache.

### Persistence
`enabled` and `range` persist in localStorage (pattern: `grayscaleMap` in
`stores/filters.ts`). Restoring `enabled` for a no-longer-entitled user resolves
to off without showing the teaser.

## 2. Backend (`trailradar-backend`)

### Shared model
- `computeTrailCondition`, `conditionModeFor`, Open-Meteo URL builder and
  `mapWeatherResponse` live in `_shared/` and are used by both `trail-condition`
  and the new refresh function — one model, one code path.
- `CONDITION_MODE.dirtpark` becomes `() => 'soil'`. `ConditionMode` `'hard'` and
  the `hard` verdict level are no longer produced; the client keeps tolerating
  `'hard'` on the wire for old caches (renders as unknown).

### Table `soil_snapshot`
| column | type |
|---|---|
| `spot_type` | text, PK part |
| `spot_id` | text, PK part |
| `lat`, `lon` | double precision |
| `level` | text (`ConditionLevel`) |
| `range_lo`, `range_hi` | smallint null |
| `pos_lo`, `pos_hi` | real null |
| `computed_at` | timestamptz |

RLS enabled, **no policies for anon/authenticated** — service role only.

### Function `soil-snapshot-refresh` (internal)
- Triggered **hourly** by pg_cron → pg_net POST with a shared-secret header
  (`SOIL_REFRESH_SECRET`); rejects anything else.
- Gate: continue only if the current Europe/Berlin hour ∈ {6, 9, 12, 15, 18}
  (hourly trigger + in-function gate keeps DST correct without two schedules).
  Accept `?force=1` with the secret for manual runs.
- Loads all approved spots from `trails`, `bike_parks`, `dirt_parks`.
- Fetches Open-Meteo in batches of ~50 locations per request (multi-location
  comma lists; same variables / `past_days` / `forecast_days` as today).
- Computes verdicts, upserts `soil_snapshot`, and also upserts `weather_cache`
  per spot (keeps the per-spot card warm for free).
- A failed batch is logged and skipped; those spots keep their previous row.

### Function `soil-map` (gated, read-only)
- JWT required; `has_min_tier(REQUIRED_LEVEL)` as the caller, else 403
  (same shape as `trail-condition`). CORS allows the localhost dev origins.
- `REQUIRED_LEVEL` must equal `FEATURES.soil_radar.minLevel` (pinned by tests in
  both repos).
- Response:
  ```ts
  interface SoilMapResponse {
    computedAt: string            // newest computed_at
    spots: Array<{ t: 'trail' | 'bikepark' | 'dirtpark'; id: string;
                   lat: number; lon: number; lvl: ConditionLevel;
                   lo: number | null; hi: number | null }>
  }
  ```
  ≈20 KB raw / ≈5 KB gzip for ~500 spots. `Cache-Control: private, no-store`
  (the client owns caching).

### Migrations (user applies)
- `soil_snapshot` table + RLS.
- Enable `pg_cron` + `pg_net`, schedule the hourly call (secret via Vault).

### Pre-launch check
Open-Meteo counts each location of a multi-location request as a call, weighted
up for long ranges / many variables: ≈5 runs × ~500 spots × weight 2–3 ≈ 7k
calls/day. Verify against the commercial plan (licence already required before
first payment).

## 3. Client (this repo)

### Entitlement
`FEATURES.soil_radar = { minLevel: 1, label: 'Boden-Radar' }` in
`app/entitlements/features.ts`; UI uses `useFeatureAccess('soil_radar')`. Real
data is requested only when it returns `allowed`.

### `app/communication/soilMap.ts`
- `fetchSoilMap(accessToken, onForbidden?) → Promise<SoilMapResponse | null>`;
  never throws. Uses `FUNCTIONS` / `userHeaders()` from `http.ts`.
- localStorage cache `tr_soil_v1` = `{ computedAt, data }`, valid until
  `nextRunAfter(computedAt)` (pure helper: next of 06/09/12/15/18 Berlin, DST
  aware, 18 → next day 06) plus a 10-minute grace for the job to finish.
- 403 → clear cache, call `onForbidden`.
- Network failure → return stale cache (caller marks it offline), else `null`.
- Corrupt entry → drop it.

### `app/stores/soilRadar.ts`
- State: `enabled`, `mode: 'live' | 'sample'`, `data: SoilMapResponse | null`,
  `range: { lo: number; hi: number }` (0–4 floats), `status: 'idle' | 'loading'
  | 'ready' | 'error'`, `offline: boolean`.
- Actions: `toggle()`, `setRange()`, `startSample()`, `stopSample()`.
- Getters: `verdictFor(type, id)`, `points` (for the layer), `freshness`.
- Gets the token from `useAuthStore()`; imports `communication/` only.

### `filtersStore`
`apply()` stays the single visibility filter (type toggles, unchanged). New pure
`soilMatch(level | undefined, range) → 'match' | 'ghost' | 'none'` in the same
store; the composable calls it, never reimplements it.

### `app/map/soilRadarLayer.ts` (pure, no store imports, Leaflet injected)
- `createSoilRadarLayer(map, L, opts) → { setPoints, setRange, playIntro,
  destroy }`.
- Own pane (`soilRadarPane`, z-index between tile pane and overlay/marker pane)
  so the grayscale filter never applies.
- Render: ¼-resolution grid over viewport + margin; per cell accumulate
  Gaussian weight and weight×level from spots within 3σ; colourise via the
  shared palette; draw to canvas, upscale with CSS blur, `mix-blend-mode:
  multiply`.
- Redraw on `moveend` / `zoomend`; CSS transform during zoom animation.
- Opacity ramp: 1 up to zoom 8, linear to 0.1 at zoom 14, floor 0.1 beyond (`zoomOpacity`).
- `playIntro()`: conic `mask-image` driven by an animated `@property --sweep`
  angle + beam overlay; resolves when done; no-op under reduced motion.

### `app/map/soilBadge.ts` (pure HTML builders, like `markerIcon.ts`)
- `SOIL_PALETTE`, `SOIL_GLYPHS` (inline SVG), `levelToAxis(level)`.
- `soilBadgeHtml(level, { delayMs })`, `clusterDonutHtml(levels)`,
  `soilChipOptions(level)` (GPX view).

### `useTrailMap`
- Creates the layer; watches `soilRadar` store (`enabled`, `points`, `range`,
  `mode`).
- Marker icons: when enabled, M2 markup (pin + badge) with angle-based pop
  delay; ghost class from `filtersStore.soilMatch`.
- Cluster group `iconCreateFunction` → donut when enabled.
- GPX view: adds soil chips.
- Toggles a `soil-radar-on` class on the map container (disables marker-pane
  grayscale in `MapView.vue`).

### Components (`app/components/map/`)
- `SoilRadarButton.vue` — FAB, lock/glow states, ≥ 44 px.
- `SoilRadarPanel.vue` — glass panel, range slider, ticks, counter, freshness.
- `SoilRadarLockedSheet.vue` — teaser sheet, reuses the promo/auth hand-off of
  `SpotDetailWeatherLocked.vue`.
All read shared stores (`soilRadar`, `auth`, `map`); no local auth state.

## 4. Errors & edge cases

| Situation | Behaviour |
|---|---|
| Fetch fails, cache exists | show cache, "· offline" |
| Fetch fails, no cache | button back to off, toast "Boden-Radar gerade nicht verfügbar" |
| 403 | clear cache, access → locked, show teaser sheet |
| Snapshot > 24 h old | show, amber "Daten veraltet" |
| Spot missing from snapshot | no badge/cloud, `soilMatch` → `none` |
| Entitlement `checking` | neutral button, tap queued |
| Sample mode | no request, no cache write, pill always visible |
| Performance | ¼ grid, redraw on `moveend` only, 3σ culling; target < 16 ms per redraw on a mid-range phone |
| Reduced motion | fades only |

## 5. Testing

**Client (vitest, mock only at the HTTP boundary):**
- `soilMap.test.ts`: token header, 403 → cache cleared + `onForbidden`, cache
  valid until next run, stale on network error, corrupt cache dropped.
- `nextRunAfter`: all five slots, both DST switches, 18 → 06 next day.
- `filtersStore.soilMatch`: raining→3, snow→4, missing→none, inclusive edges,
  full range matches missing.
- `soilBadge`: glyph + colour per level, donut shares sum to 100 %.
- `soilRadarLayer`: 20 km → σ px at several zooms, 3σ culling, colour/alpha of a
  cell between two spots; canvas stubbed.
- Components: locked tap → sample pill + sheet + no fetch; panel slider updates
  range and counter; button states.
- `features.test.ts` pins `soil_radar.minLevel`; `architecture.test.ts` covers
  the new `app/map/` files (no store imports).

**Backend (Deno):**
- refresh: Berlin-hour gate incl. DST, secret check, batching, failed batch
  keeps old rows, upsert shape, `weather_cache` written.
- `soil-map`: 401 / 403 / 200, response shape, `REQUIRED_LEVEL` pinned.
- `CONDITION_MODE`: pumptrack-only dirtpark → `soil`.

**Playwright (one spec):** Supporter toggles radar → badges visible, slider
ghosts spots; free user → sample pill + sheet.

**Manual:** small viewport (thumb reach, slider), standalone PWA, iOS shell.

## Out of scope
- Forecast / weekend time slider.
- Interpolated full-coverage radar (B2).
- Per-spot SoilGrids texture in the cloud colour.
- Push notifications ("Hero Dirt near you").
