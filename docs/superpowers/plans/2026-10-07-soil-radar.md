# Boden-Radar — implementation plan

Spec: `docs/superpowers/specs/2026-10-07-soil-radar-design.md` (read it first; it
is the source of truth for behaviour). Mockups with palette, glyph SVGs, sweep
CSS and cloud maths: `docs/superpowers/specs/2026-10-07-soil-radar-mockups/`.

Integration branch (frontend): `worktree-feat-soil-radar`.
Backend branch: `feat/soil-radar` in `trailradar-backend`.

Work is split into tracks so parallel agents never edit the same file. Each
track ends with green tests and commits on its own branch; the coordinator
merges tracks into the integration branch.

```
Wave 1 (parallel):  BE  backend          FD  client data layer      FM  client map rendering
Wave 2:                                  FU  client UI components   (needs FD)
Wave 3:                                  FI  integration + e2e      (needs FD, FM, FU)
```

## Shared contracts (all tracks code against these — do not change them unilaterally)

### Wire format of `soil-map` (BE produces, FD consumes)
```ts
// POST {FUNCTIONS}/soil-map, Authorization: Bearer <user JWT>, empty body.
// 200:
interface SoilMapResponse {
  computedAt: string               // ISO, newest computed_at in the snapshot
  spots: SoilMapSpot[]
}
interface SoilMapSpot {
  t: 'trail' | 'bikepark' | 'dirtpark'
  id: string
  lat: number
  lon: number
  lvl: ConditionLevel              // same union as app/types/Weather.ts
  lo: number | null                // ConditionRange.lo (0..4) or null
  hi: number | null
}
// 401 { error: 'unauthorized' } · 403 { error: 'forbidden' } · 500 { error: 'failed' }
```

### Soil axis (FD owns `app/types/SoilMap.ts`)
`levelToAxis(level)`: `dusty 0, dry 1, prime 2, damp 3, wet 4, raining 3, snow 4,
hard null, unknown null`. `isFrost(level)` = `level === 'snow'`.

### Map layer input (FM owns, FI wires)
```ts
// app/map/soilRadarLayer.ts
export interface SoilPoint { lat: number; lon: number; axis: number; frost: boolean }
export function createSoilRadarLayer(map: L.Map, L: typeof import('leaflet'), opts?: {
  radiusMeters?: number   // default 20_000
}): {
  setPoints(points: SoilPoint[]): void   // already range-filtered by the caller
  setVisible(on: boolean): void          // fade in/out
  playIntro(): Promise<void>             // sweep; resolves immediately under reduced motion
  destroy(): void
}
```

### Store API (FD owns `app/stores/soilRadar.ts`, FU/FI consume)
```ts
useSoilRadarStore(): {
  enabled: Ref<boolean>; mode: Ref<'live' | 'sample'>
  data: Ref<SoilMapResponse | null>
  range: Ref<{ lo: number; hi: number }>          // 0..4 floats, default {0,4}
  status: Ref<'idle' | 'loading' | 'ready' | 'error'>
  offline: Ref<boolean>
  points: ComputedRef<SoilMapSpot[]>              // live data or sample scene
  freshness: ComputedRef<{ computedAt: string; stale: boolean; offline: boolean } | null>
  verdictFor(type: string, id: string): ConditionLevel | undefined
  toggle(): Promise<void>        // live: loads data (cache/fetch) then enabled=true
  setRange(lo: number, hi: number): void
  startSample(center: { lat: number; lon: number }): void
  stopSample(): void
}
```
Plus `filtersStore.soilMatch(level: ConditionLevel | undefined, range) →
'match' | 'ghost' | 'none'` in `app/stores/filters.ts`.

---

## Track BE — backend (`trailradar-backend`, branch `feat/soil-radar`)

Follow that repo's `CLAUDE.md` (pure `handler.ts` with injected deps, `index.ts`
wiring, Deno tests, never hit network). Run `npm test` (or `npx deno test
--allow-env --allow-read supabase/functions scripts`).

- [ ] **BE1 Drop the asphalt assumption.** `_shared/trailCondition.ts`
  `CONDITION_MODE.dirtpark` → `() => 'soil'`. Update the affected tests
  (`trailCondition.test.ts`, `viewModel.test.ts`, `trail-condition/handler.test.ts`,
  any fixture expecting `'hard'`). Keep `ConditionMode`'s `'hard'` member only if
  removing it ripples too far; it must no longer be produced. Update the
  `CLAUDE.md` text that mentions hard.
- [ ] **BE2 Migration `soil_snapshot`.** New file in `supabase/migrations/`
  (timestamp `20261007150000_add_soil_snapshot.sql`): table per spec §2
  (PK `(spot_type, spot_id)`), RLS enabled, no policies, comment explaining why.
- [ ] **BE3 Multi-location Open-Meteo.** In `trail-condition/openMeteo.ts` add
  `buildWeatherUrlMulti(coords, apiKey?)` (comma-joined lat/lon, same params) and
  `fetchOpenMeteoMulti(coords, apiKey?, fetchFn?) → Promise<(SpotWeather|null)[] | null>`
  (response is an array for >1 location, an object for exactly 1 — normalise;
  map each with `mapWeatherResponse`). Tests with a trimmed 2-location fixture.
- [ ] **BE4 `loadAllSpots`.** In `trail-condition/spots.ts`: list every approved
  spot of all three types with coords + surface (check each table's approval
  column / existing frontend list endpoints for what "approved" means; ask in
  your report if unclear rather than guessing silently). Tests with the fake client.
- [ ] **BE5 `soil-snapshot-refresh` function.** `supabase/functions/soil-snapshot-refresh/`
  with `handler.ts` (pure) + `index.ts` + `config.toml` block (`verify_jwt = false`).
  - Auth: header `x-refresh-secret` must equal env `SOIL_REFRESH_SECRET` (constant-time compare), else 401.
  - Gate: `berlinHour(now) ∈ {6,9,12,15,18}` (use `Intl.DateTimeFormat` with
    `timeZone: 'Europe/Berlin'`), else 200 `{ skipped: true }`. `?force=1` bypasses the gate (still needs the secret).
  - Load spots → batches of 50 → `fetchOpenMeteoMulti` → for each weather run
    `computeTrailCondition(weather, conditionModeFor(surface), now)` → upsert
    `soil_snapshot` rows and `weather_cache` (`putCached`) for that spot.
  - Failed batch: log, skip (old rows stay). Response `{ ok, spots, failedBatches }`.
  - Tests: secret, gate incl. both DST switch days (2026-03-29, 2026-10-25), force,
    batching (120 spots → 3 calls), failed batch keeps going, row shape.
- [ ] **BE6 `soil-map` function.** `supabase/functions/soil-map/` (`handler.ts`,
  `index.ts`, `cors.ts` copied from `add-trail` — localhost dev origins allowed —
  `config.toml` block). JWT → `getUser`, `has_min_tier(REQUIRED_LEVEL = 1)` as
  caller; service role reads all `soil_snapshot` rows; returns the contract above.
  Tests: OPTIONS, 401, 403, 200 shape, empty table → `{ computedAt: '', spots: [] }`,
  `REQUIRED_LEVEL === 1` pinned.
  (The model stays where it is — `_shared/` + `trail-condition/` helpers, imported
  the same way `soil-report` already does; no move needed.)
- [ ] **BE7 Cron migration.** `20261007150100_schedule_soil_snapshot_refresh.sql`:
  `create extension if not exists pg_cron; create extension if not exists pg_net;`
  `cron.schedule('soil-snapshot-refresh', '0 * * * *', $$ select net.http_post(...) $$)`
  reading URL + secret from `vault.decrypted_secrets` (names
  `soil_refresh_url`, `soil_refresh_secret`). Header comment: the vault secrets
  must be created by hand first (give the exact SQL).
- [ ] **BE8 Docs.** Add both functions to `CLAUDE.md`'s function list/sections.

## Track FD — client data layer (frontend)

- [ ] **FD1 Entitlement.** `FEATURES.soil_radar = { minLevel: 1, label: 'Boden-Radar' }`
  with a comment mirroring `trail_condition`'s (server gate = `soil-map`).
  Pin it in `app/entitlements/features.test.ts`.
- [ ] **FD2 Types.** `app/types/SoilMap.ts`: `SoilMapResponse`, `SoilMapSpot`,
  `levelToAxis`, `isFrost`, `SOIL_AXIS_MAX = 4`. Unit tests.
- [ ] **FD3 `nextRunAfter`.** `app/communication/soilSchedule.ts`:
  `SOIL_RUN_HOURS = [6, 9, 12, 15, 18]`, `nextRunAfter(computedAt: Date): Date`
  (Europe/Berlin, DST-correct, 18:xx → next day 06:00). Tests incl. DST days.
- [ ] **FD4 `fetchSoilMap`.** `app/communication/soilMap.ts`, mirroring
  `weather.ts`: `fetchSoilMap(accessToken, onForbidden?) → Promise<{ data, offline } | null>`;
  cache key `tr_soil_v1`, valid until `nextRunAfter(computedAt) + 10 min`; 403 →
  clear + `onForbidden`; network error → stale cache with `offline: true`; corrupt
  → drop. Never throws. Tests mock `fetch` only.
- [ ] **FD5 `soilMatch`.** In `app/stores/filters.ts` (spec §1 filter semantics:
  inclusive; `undefined`/null axis → `'none'`, which counts as visible only when
  range is full `{0,4}`). Tests.
- [ ] **FD6 Store.** `app/stores/soilRadar.ts` per the contract; persists
  `enabled` + `range` in localStorage (pattern `grayscaleMap`); `toggle()` uses
  `useAuthStore()` for the token, calls `fetchSoilMap`; on 403 sets an
  `forbidden` flag the UI reacts to; sample scene = fixed list of ~25 fake spots
  generated deterministically around `center` (mix of all levels, a "front"
  so it looks plausible); sample never fetches/caches. Tests with mocked
  `fetchSoilMap`.
- [ ] **FD7 Old `hard` on the wire.** Anywhere the client switches on
  `'hard'` (`SpotDetailWeather.vue` etc.) keep it harmless (render like
  unknown/plain). No behaviour change needed beyond not crashing; add/adjust a test.

## Track FM — client map rendering (frontend, pure modules)

No store/composable imports (architecture rule for `app/map/`).

- [ ] **FM1 `app/map/soilBadge.ts`.** `SOIL_PALETTE` (L1 Earth: `#e0a526,
  #8bbf3f, #16c060, #2ea8e6, #6d4c41`, frost `#e8f4ff`), `SOIL_GLYPHS` (inline SVG
  from `markers-M2.html`; plus snowflake + rain), `axisColor(axis)` (continuous
  ramp), `soilBadgeHtml(level, { delayMs? })` (returns `''` for unknown/hard),
  `markerWithSoilBadgeOptions(type, approved, level, delayMs)` (wraps
  `markerIconOptions` markup + badge; same anchor), `clusterDonutHtml(levels)`
  (conic-gradient shares, count, `glow` class if any prime), `soilChipOptions(level)`
  for the GPX view. CSS for these classes in a new `app/css/soil_radar.css`
  (badge, breathe animation, ghost class `.soil-ghost`, donut, chip,
  reduced-motion overrides). Tests on the HTML/opts output.
- [ ] **FM2 `app/map/soilField.ts`** (pure maths, no Leaflet): `sigmaPx(radiusMeters,
  metersPerPixel)`, `renderField(points: {x,y,axis,frost}[], w, h, sigmaPx, scale=0.25)
  → ImageData-like {width,height,data}` (Gaussian weight, weighted mean axis,
  alpha = min(0.72, (Σw·0.9)^0.8·0.72), 3σ culling, frost blends toward white).
  Tests: σ conversion, culling, colour between two spots, empty → transparent.
- [ ] **FM3 `app/map/soilRadarLayer.ts`.** Contract above. Creates pane
  `soilRadarPane` (zIndex 350), a canvas sized to the map, redraws on
  `moveend`/`zoomend`/`resize` via `soilField`, CSS blur + `mix-blend-mode:
  multiply`, opacity ramp zoom 10→11 (import `GPX_ZOOM_THRESHOLD`), zoom-anim
  transform, `playIntro()` with `@property --soil-sweep` conic mask + beam
  element (see `look-L1.html`), honours `prefers-reduced-motion`. Tests with a
  minimal fake map + stubbed canvas context (what's practical: listeners
  registered/removed, setPoints triggers redraw, destroy cleans up, reduced
  motion resolves immediately).

## Track FU — client UI components (after FD merged)

Components in `app/components/map/`, custom CSS, mobile-first, touch targets
≥ 44 px, German copy. Read shared stores only.

- [ ] **FU1 `SoilRadarButton.vue`.** FAB matching `.location-btn` style; states:
  checking (neutral, tap queued), locked (lock overlay), off, on (green ring +
  glow). Tap: allowed → `store.toggle()`; locked → emits `teaser` (FI starts the
  sample + opens sheet). Tests.
- [ ] **FU2 `SoilRadarPanel.vue`.** Glass bottom panel (shown when `enabled`):
  ramp (`SOIL_PALETTE` gradient) as two-handle range slider (pointer events,
  keyboard arrows, `role="slider"` ×2 with aria values), glyph+label ticks,
  counter chip (prop `matchCount`/`totalCount`), freshness line ("Stand 15:00",
  "Stand Mo 18:00 · offline", amber "Daten veraltet" > 24 h), "Beispielansicht"
  pill in sample mode. Tests: dragging/keyboard updates `setRange`, labels.
- [ ] **FU3 `SoilRadarLockedSheet.vue`.** Bottom sheet, copy per spec §1;
  logged-out + promo → button opens `mapStore.authModalOpen`; logged-in → link
  `/supporter`. Close → emits `close` (FI stops sample). Reuse patterns of
  `SpotDetailWeatherLocked.vue`. Tests.

## Track FI — integration (after FD, FM, FU merged)

- [ ] **FI1 `useTrailMap`.** Create the layer after map init; `watch` store
  `enabled/mode/points/range`: compute `SoilPoint[]` for spots whose
  `soilMatch` is `'match'`, `setPoints`, `setVisible`; on first enable call
  `playIntro()`. Marker icons: when enabled use
  `markerWithSoilBadgeOptions` with angle-from-centre delay and `.soil-ghost`
  for `'ghost'`/`'none'` (per semantics); cluster `iconCreateFunction` → donut
  when enabled (default icon otherwise); GPX view: soil chips for spots in view.
  Toggle `soil-radar-on` class on the map container. Destroy layer in cleanup.
- [ ] **FI2 `MapView.vue`:** `.map-grayscale.soil-radar-on .leaflet-marker-pane { filter: none }`;
  import `soil_radar.css`.
- [ ] **FI3 `map.vue`:** mount button, panel, sheet; wire teaser (start sample
  at map centre + open sheet, close → stop sample); counter = matches in viewport.
- [ ] **FI4 Tests.** `architecture.test.ts`: new `app/map/soil*` files import no
  stores/composables (extend existing assertion if one covers `app/map/`
  generically — then just confirm). Playwright spec `tests/soil-radar.spec.ts`:
  mock `soil-map` + entitlement at the network boundary like existing specs;
  Supporter enables → badges visible, slider ghosts; free user → sample pill +
  sheet. Use a free port per the worktree-test-traps note (don't reuse :3000).
- [ ] **FI5 Verify.** `npm test`, `npm run lint:arch`, e2e spec, manual small
  viewport check via screenshots.

## Definition of done
All tracks merged into `worktree-feat-soil-radar`; `npm test` + `lint:arch` +
the new e2e spec green; backend `npm test` green on `feat/soil-radar`;
migrations + secrets listed for the user to apply/deploy (nothing deployed or
pushed by agents).
