# Parking lots per spot — design

Date: 2026-07-30

> **Update 2026-07-31:** the four separate hint columns (`weight_limit_hint`,
> `opening_hours_hint`, `cost_hint`, `charging_hint`) described below were
> replaced with a single `info text[]` column — a free-text array with
> suggested chip labels (opening hours, weight/height limit, costs,
> charging) in the editor UI, but no per-category storage. See migration
> `supabase/migrations/20260731090000_simplify_parking_info.sql`. The rest
> of this document (data model shape aside) still reflects the current
> design.

## Summary

Each spot (trail, bikepark, or dirtpark) can have zero or more parking lots. A parking lot is a point (lat/lng) with a required name and four optional plain-text hint fields (weight limit, opening hours, cost, charging infrastructure). Trailcrew (for their assigned spots) and admins manage parking lots in SpotManager; they render on the main map with a dedicated icon and are browsable from the existing spot detail panel.

## Decisions from clarification

- A parking lot always belongs to exactly one spot (no standalone/orphan lots).
- Parking lots have a required `name` field (e.g. "Main Lot", "North Entrance") for display in lists and popups.
- Trailcrew (via `can_edit_spot`) can insert, update, **and delete** their own spots' parking lots — this deliberately diverges from the `spot_gpx_trails`/`spot_gpx_tours` convention where DELETE is admin-only.
- Coordinates are set via a click-to-place mini map picker in the SpotManager editor (not manual lat/lng number entry).
- Available for all spot types: trail, bikepark, dirtpark.
- No filter toggle — parking markers simply follow the existing GPX zoom-threshold show/hide behavior, with no entry in `filtersStore`.
- Marker icon: a circular badge (not the teardrop spot-pin shape, to read as clearly secondary/auxiliary), blue (German road-sign parking blue, e.g. `#0d5db8`) background with a white "P".
- SpotManager UI: a list view that swaps to a separate editor view (like `EmbedTokenList`/`EmbedTokenEditor`), not inline draggable cards — parking lots don't need a meaningful order. The list reuses the same blue "P" badge icon used on the map.
- Clicking a parking marker on the main map opens the existing `SpotPanel` for the owning spot, jumped straight to a new "Parking" tab with that lot highlighted (rather than the default "Info" tab used by a spot-marker click).

## 1. Data model & migration

New table `parking`. Spots live in three separate tables (`trails`, `parks` for bikeparks, `dirt_parks` for dirtparks) with no shared namespace-safe way to FK a single column to all three — so, matching the existing `spot_gpx_trails`/`spot_gpx_tours` pattern, `spot_id` is a plain indexed `text` column with **no FK constraint**, validated at the application layer.

```sql
CREATE TABLE "public"."parking" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "spot_id" text NOT NULL,
    "name" text NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "weight_limit_hint" text,
    "opening_hours_hint" text,
    "cost_hint" text,
    "charging_hint" text,
    "created_at" timestamptz DEFAULT now()
);
CREATE INDEX "parking_spot_id" ON "public"."parking" USING btree ("spot_id");

ALTER TABLE "public"."parking" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read parking" ON "public"."parking" FOR SELECT USING (true);
CREATE POLICY "insert own scope" ON "public"."parking" FOR INSERT TO authenticated WITH CHECK (can_edit_spot(spot_id));
CREATE POLICY "edit own scope" ON "public"."parking" FOR UPDATE TO authenticated, service_role USING (can_edit_spot(spot_id));
CREATE POLICY "delete own scope" ON "public"."parking" FOR DELETE TO authenticated, service_role USING (can_edit_spot(spot_id));
```

`can_edit_spot(spot_id)` already handles all three spot types generically (it only checks `is_admin()` or a matching `trailcrew_spots` row) — no changes needed there.

This will be a proper checked-in migration file under `supabase/migrations/`. (Note for the team: `embed_tokens`/`embed_token_trails` were applied directly against the DB previously and never captured in a migration — this feature should not repeat that gap.)

## 2. Communication / API layer

**`src/spot_manager/Api.ts`** (gold-standard HTTP layer) — CRUD for SpotManager, following the `upsertTrail`/`deleteTrail` pattern (no file-storage cleanup needed, since parking lots have no associated files):

```ts
export interface ParkingRow {
  id: string; spot_id: string; name: string; lat: number; lng: number;
  weight_limit_hint?: string | null;
  opening_hours_hint?: string | null;
  cost_hint?: string | null;
  charging_hint?: string | null;
}

export async function getSpotParking(spotId: string): Promise<ParkingRow[]>
export async function upsertParking(row: Partial<ParkingRow> & { spot_id: string }, jwt: string): Promise<ParkingRow>
export async function deleteParking(id: string, jwt: string): Promise<void>
```

**`src/communication/trails.ts`** — public batch-fetch for the map, same return shape as `fetchMultipleSpotGpx`:

```ts
export interface SpotParkingLot {
  id: string; name: string; lat: number; lng: number;
  weight_limit_hint?: string; opening_hours_hint?: string;
  cost_hint?: string; charging_hint?: string;
}

export async function fetchMultipleSpotParking(spotIds: string[]): Promise<Map<string, SpotParkingLot[]>>
```

Unlike `fetchMultipleSpotGpx` (which fetches the entire `spot_gpx_*` tables unfiltered and groups client-side — an existing inefficiency, `idList` is built but unused there), `fetchMultipleSpotParking` is new code and will correctly filter with `spot_id=in.(...)`.

## 3. Map display & spot panel integration

**Icon** (`src/map/markerIcon.ts`): new `parkingIconOptions()` — blue circle badge with white "P", exported so both the map and the SpotManager list render the identical icon.

**Rendering trigger** (`src/composables/useTrailMap.ts`): parking markers follow the same zoom-triggered path as the GPX overview. Inside `renderGpxView()` (or a function invoked alongside it), `fetchMultipleSpotParking(uncached)` is batch-fetched and cached in a `parkingCache` Map, using the same caching/staleness (`renderGuard`) pattern as `gpxCache`. Each lot becomes one `L.marker` with the parking icon, added directly to the map as plain layers (mirrors `gpxLayers` — not clustered), cleared/recreated on the same zoom-out/zoom-in and pan transitions as GPX lines.

**Click behavior**: clicking a parking marker looks up its owning spot (by `spot_id`) from the already-loaded filtered spot list, then opens the existing `SpotPanel` via a new `openParkingLot(spot, parkingLot)` entry point — opens the panel and activates a new "Parking" tab with that lot highlighted/scrolled into view, instead of defaulting to "Info" as a spot-marker click does.

**SpotPanel** (`src/map/spot_panel/spotPanel.ts`): a new 4th tab, "Parking," shown for any spot type (trail/bikepark/dirtpark) — unlike Tours/Trails, which stay trail-only. Parking lots are fetched on `open()` regardless of spot type; the tab is hidden if the spot has zero lots. Tab content lists each lot's name plus its populated hint fields as plain text, via a new `parkingHTML()` renderer in `spotPanelHtml.ts` (same pattern as `toursHTML`/`trailsHTML`).

## 4. SpotManager UI

Follows the `view` ref + list/editor toggle pattern from `EmbedTokenList`/`EmbedTokenEditor`, added to `SpotManagerApp.vue`'s `View` union (`'parking-list' | 'parking-edit'`):

```html
<ParkingList v-else-if="view === 'parking-list'"
  @create="openParkingEditor(null)" @edit="openParkingEditor" @delete="confirmParkingDelete" />
<ParkingEditor v-else-if="view === 'parking-edit'"
  @cancel="openParkingList" @saved="openParkingList" />
```

- **`ParkingList.vue`** — rows showing the blue "P" badge icon + lot name, click row → edit, "+ New parking lot" entry, per-row delete icon (trailcrew can delete their own spots' lots, per Section 1).
- **`ParkingEditor.vue`** — form: name (required text), the four hint fields as plain textareas (weight limit, opening hours, cost, charging), and a coordinate picker.
- **`LocationPicker.vue`** (new, reusable): `modelValue: {lat, lng}` / `update:modelValue`, wraps its own small Leaflet instance with click-to-place + draggable pin. No reusable lat/lng-picker exists anywhere in the codebase today — the only precedent is the full-size main-map add-spot click flow in `useTrailMap.ts:482-508`, which is imperative code tied to the main map instance and not embeddable in a form. `LocationPicker.vue` crib the crosshair-cursor/click-handler logic from there but is a fresh, form-embeddable component. It lives in `src/spot_manager/`, not `src/map/` — consistent with the existing precedent of `spot_manager/MapView.ts` already owning its own separate Leaflet instance (for GPX segment editing) outside `src/map/`. This also keeps the existing enforced architecture test (`SpotManagerApp.vue does not import from src/map/ directly`) green with no changes needed.

## 5. Testing

- **`src/spot_manager/Api.test.ts`** — add cases for `getSpotParking`, `upsertParking` (insert vs. update branch), `deleteParking`, mocking `fetch` at the HTTP boundary (existing pattern in this file).
- **`src/communication/trails.test.ts`** — `fetchMultipleSpotParking`: empty input → empty Map; multiple spot IDs group correctly by `spot_id`; the `in.(...)` filter is applied.
- **`src/map/markerIcon.test.ts`** — `parkingIconOptions()` returns the expected className/html for the blue "P" badge.
- **`src/map/spot_panel/spotPanelHtml.test.ts`** — new `parkingHTML()`: renders name + populated hints, and cleanly omits a hint line when a hint field is null (not a literal "null" string).
- **`LocationPicker.vue`** — no existing precedent in this codebase for unit-testing a Leaflet-backed component in jsdom. Rather than testing the mounted map, the click→lat/lng conversion is extracted into a small pure function (same spirit as `GpxProcessor.ts`'s pure functions) and unit-tested directly; the Leaflet wiring itself is verified manually.
- **Architecture tests** — no new invariant required; the existing `SpotManagerApp.vue does not import from src/map/ directly` test already guards the `LocationPicker.vue` placement decision above.
- **RLS policies** — not covered by vitest (no local Postgres in this stack); verified manually against Supabase after the migration runs, same as the existing `can_edit_spot`-gated policies.
- **Playwright** (`tests/spotmanager.spec.ts`) — this feature touches both the SpotManager flow and map interaction, so per the mandatory E2E rule, extend the existing spec with one happy-path case: trailcrew adds a parking lot → it's persisted and listed. The map-click-opens-panel-to-Parking-tab behavior gets a scoped E2E case if feasible within the zoom-threshold timing constraints of the existing GPX-overview tests; otherwise it's documented as a manual QA step.

## Out of scope

- Structured parsing of the hint fields (e.g. actual weight-limit numbers, opening-hours schedules) — they stay plain free text, per the original request.
- A filter toggle to hide/show parking markers independently of zoom level.
- Admin approval workflow for parking lots (they're gated by `can_edit_spot`, same as GPX tracks — no separate approval step).
