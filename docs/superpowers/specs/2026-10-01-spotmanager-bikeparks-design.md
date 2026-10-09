# SpotManager: manage bikeparks

Date: 2026-10-01
Status: design approved (incl. §6), not yet implemented
Plan: `docs/superpowers/plans/2026-10-01-spotmanager-bikeparks.md`

## Goal

Let admin and trailcrew manage **bikeparks** (`parks` table) in SpotManager as
standalone spots — no trail as entry point — with the small set of settings a
bikepark actually has. Trails keep working unchanged, plus one new field
(website).

## Scope

**In (bikepark):** status (open / closed only), opening hours, description,
website, parking lots, invitation codes (trailcrew onboarding), embed tokens
(already type-aware, no change).

**In (trails):** a website field in the existing Spot-Details editor.

**Out, deliberately:**
- Dirtparks (`dirt_parks`) — later iteration; they are not listed in the picker
  until their editor exists.
- GPX trails / tours / segment editor for any park type.
- Bikepark status hint, "open again on" date, access/donation, seasonal, rain,
  night, rules, affected trails, lift/ticket/price info.
- Park photos/likes/clicks/shares (their FKs also point at `trails` only —
  separate, pre-existing bug).
- Retiring/editing the `bike-parks-details` edge function (lives in
  `../trailradar-backend`; its POST write path stops working once RLS is
  locked, which is accepted — "we will adapt later").
- Type filter chips in the picker (YAGNI; a badge is enough).

## Why per-type details tables, not `trail_details`

`trail_details` is trail-shaped (rain/night/season/donation) and its
`trail_id` FK points at `trails`. `bike_park_details` already exists with an FK
to `parks`, already carries `status` and `opening_hours`, and is what the
public `bike-parks-details` edge function reads. A bikepark editor writing
there needs one new column and no FK surgery on `trail_details`.

## Findings that shape the design

- `trailcrew_spots.spot_id` and `invitation_codes.spot_id` have FKs to
  `trails(id)` only. Both block parks. `redeem_invitation()` itself has no
  `trails` dependency — it inserts the spot id into `trailcrew_spots` — so
  invite codes work for parks once those two FKs are gone.
- `can_edit_spot(text)` is already type-agnostic (compares
  `trailcrew_spots.spot_id::text`).
- `bike_park_details` RLS today: anon INSERT and UPDATE with `USING (true)` —
  anyone with the public anon key can rewrite any bikepark's status/rules.
  Violates the "`can_edit_spot` is the only write gate" rule.
- `trails`, `parks`, `dirt_parks` have **no UPDATE policy** for anyone, so
  `url` (website) is only editable in the Supabase dashboard today.
- The public detail UI renders `details.trail_description` ("Allgemeine
  Infos") and `details.opening_hours`. Naming the new column
  `trail_description` (not `description`) needs **no mapping layer** on either
  public read path (REST merge, edge function `select('*')`).
- `getTrailById` / `getTrailBySlug` merge only `trail_details`, so bikepark
  details never reach the detail page today.
- Legacy `bike_park_details` rows were seeded by an AI-analysis script:
  `status` may be `open|closed|unknown`, plus `status_hint` and `rules`.

## Design

### 1. Migration — `supabase/migrations/20261001120000_spotmanager_bikeparks.sql`

Lives in this (frontend) repo, like the parking/comments/photo migrations.

1. **`spot_exists(p_id text) → boolean`** — `SECURITY DEFINER`, `STABLE`,
   `search_path = public`; true if the id is in `trails`, `parks` or
   `dirt_parks`.
2. **Drop** `trailcrew_spots_spot_id_fkey` and `invitation_codes_spot_id_fkey`;
   replace with `BEFORE INSERT OR UPDATE OF spot_id` triggers calling a shared
   `check_spot_exists()` that raises `foreign_key_violation` for unknown ids.
   No delete cascade is added: the old `trailcrew_spots` FK had none, and
   spot deletion is a manual admin operation.
3. **`bike_park_details`:**
   - `ADD COLUMN trail_description text` (+ `CHECK (char_length <= 2000)`).
   - `CHECK (status IS NULL OR status IN ('open','closed','limited','unknown'))
     NOT VALID` — guards new writes, never validates legacy rows.
   - Drop the anon `"set"` INSERT and `"update"` UPDATE policies; add
     `"insert own scope"` (INSERT, `authenticated`, `WITH CHECK
     can_edit_spot(id)`) and `"edit own scope"` (UPDATE,
     `authenticated, service_role`, `USING/WITH CHECK can_edit_spot(id)`).
     The anon SELECT policy stays.
4. **`set_spot_website(p_spot_id text, p_url text) → void`** —
   `SECURITY DEFINER`, `search_path = public`. Raises `42501` unless
   `can_edit_spot(p_spot_id)`; trims; empty → `''`; otherwise requires
   `^https?://\S+$` and length ≤ 500 (`invalid_url`); updates `url` in
   whichever of `trails`/`parks`/`dirt_parks` owns the id (`unknown_spot` if
   none). `REVOKE ALL … FROM public, anon; GRANT EXECUTE … TO authenticated`.
   A function, not a table policy, because RLS cannot restrict columns —
   an UPDATE policy would let trailcrew rewrite name/coordinates/`approved`.

Existing bikepark rows keep their legacy `rules`, `status_hint`, `status`
(including `unknown`) — unchanged by the migration. (`status_hint` is cleared
later, per row, when an operator saves — §6.)

### 2. Spot types — `app/spot_manager/spotTypes.ts` (new, pure)

```ts
export const SPOT_CAPABILITIES: Record<anyTrailType, {
  manageable: boolean          // listed in the SpotManager picker
  gpx: boolean                 // Touren / Trails / segment editor
  details: 'trail' | 'bikepark' | null   // which Spot-Details editor
  table: 'trails' | 'parks' | 'dirt_parks'
  label: string                // picker badge, German
}> = {
  trail:    { manageable: true,  gpx: true,  details: 'trail',    table: 'trails',     label: 'Trail' },
  bikepark: { manageable: true,  gpx: false, details: 'bikepark', table: 'parks',      label: 'Bikepark' },
  dirtpark: { manageable: false, gpx: false, details: null,       table: 'dirt_parks', label: 'Dirtpark' },
}
```

Open/closed, like `DETAIL_ENDPOINT`: a new type is a new entry, and
`SpotManagerApp.vue` reads capabilities instead of `type ===` chains (enforced
by an architecture test). Enabling dirtparks later = flip `manageable`, add a
`details` kind.

### 3. API — `app/spot_manager/Api.ts`

- `SpotRow` gains `type: anyTrailType` and `url?: string | null`.
- `getManageableSpots(jwt, userId, role)`:
  - admin: one request per `manageable` table (`trails`, `parks`) with
    `select=id,name,latitude,longitude,approved,url`, merged, tagged with
    `type`, sorted by name.
  - trailcrew: read `trailcrew_spots?select=spot_id&user_id=eq.<id>`, then
    `id=in.(…)` on each manageable table (the old `trails(...)` embed no
    longer works without the FK); skip all queries when there are no
    assignments.
- `BikeParkDetailsRow { id, status, opening_hours, trail_description,
  last_update }`; `getBikeParkDetails(id)` (anon GET);
  `upsertBikeParkDetails(row, jwt)` — `POST bike_park_details?on_conflict=id`,
  `Prefer: resolution=merge-duplicates,return=representation`. Only the
  columns above plus `status_hint: null` (spec §6) are sent, so legacy `rules`
  stay untouched. First save for a
  bikepark with no row inserts it (the edge function's `.single()` makes a
  missing row a 500, so the editor must not assume a row exists).
- `setSpotWebsite(spotId, url, jwt)` → `POST rpc/set_spot_website`.
- `getTrailById`/`getTrailBySlug` — see §5.

### 4. UI — `app/components/spotmanager/`

- **`SpotManagerApp.vue`** (already 2.2k lines — no new type logic inlined):
  - Picker rows show a type badge from `SPOT_CAPABILITIES[type].label`.
  - `openSpot` skips `getSpotTrails`/`getSpotTours` when `!gpx` and loads
    details by `details` kind.
  - List view: Touren and Trails sections render only for `gpx`. Spot-Details
    and Parkplätze banners always render. The Spot-Details banner opens the
    editor for the spot's `details` kind (`view = 'details'` for trails,
    new `'bikepark-details'` for bikeparks); breadcrumbs/`stepBack` get the
    new view.
  - Banner subtitle for bikeparks: status label (open/closed) +
    opening-hours snippet, or "Nicht konfiguriert".
- **`BikeParkDetailsEditor.vue`** (new; props/emits like `ParkingEditor.vue`):
  status toggle (Offen / Gesperrt), Öffnungszeiten textarea, Beschreibung
  textarea (≤ 2000), website field, invitation codes. Legacy `unknown`/null
  status shows neither option selected and saves as whatever the operator
  picks. Save = `upsertBikeParkDetails` then, if the website changed,
  `setSpotWebsite`.
- **`SpotInvitationCodes.vue`** (new, extracted from the inline block in the
  trail Spot-Details editor; uses `communication/invitations.ts`) — shared by
  both editors instead of duplicating state and handlers.
- **`SpotWebsiteField.vue`** + pure `spotWebsite.ts`
  (`normalizeWebsiteUrl`, validation matching the RPC) — shared by both
  editors. The trail editor's `saveDetails` additionally calls
  `setSpotWebsite` when the website changed.
- Mobile: the new editor reuses `sd-*` / `sm-*` classes from
  `spotmanager-shared.css`; touch targets and bottom-sheet scrolling checked
  at small viewports.

### 5. Public read path — `app/communication/trails.ts`

A `SPOT_DETAILS_SOURCE: Record<Trail['type'], { table; idColumn; columns }>`
map: trail and dirtpark keep `trail_details` by `trail_id` (unchanged
behaviour); bikepark reads `bike_park_details` by `id` with
`status,status_hint,opening_hours,rules,trail_description,last_update`.
`getTrailBySlug` already resolves the type before fetching details, so it uses
the map directly. `getTrailById` becomes two-phase (resolve base row + type,
then fetch details/photos), like `getTrailBySlug`; it is only the legacy
id-URL fallback, so the extra round trip is acceptable.

The map panel (edge function `bike-parks-details`, `select('*')`) already
returns `trail_description` with no change.

### 6. Decision: clear the stale `status_hint` on save (approved)

`SpotDetailStatus.vue` shows `effectiveStatus.reason || details.status_hint`
whenever a spot is closed. Legacy bikepark rows are left untouched by the
migration, so without this a machine-generated hint from the import would be
displayed as the closure reason the first time an operator sets a park to
*closed*. The bikepark editor's save therefore writes `status_hint: null`: the
stale text disappears the moment an operator takes ownership of a park, and
rows nobody edits are unchanged. `upsertBikeParkDetails` sends
`status_hint` (always `null`) in addition to the other columns; legacy `rules`
are still never written.

## Testing

Vitest first; Playwright only where a real mount is unavoidable. Per
CLAUDE.md, each bug-class change gets a test that fails before the fix and
nothing calls the production database.

- `spotTypes.test.ts` — every `anyTrailType` has a capability entry; only
  trail and bikepark are `manageable`; only trail has `gpx`.
- `Api.test.ts` — `getManageableSpots`: admin merges trails + parks sorted
  with `type`; trailcrew resolves ids via `trailcrew_spots` then `in.()`
  per table, makes no embed request, and makes no table requests when
  unassigned; dirtparks never requested. `getBikeParkDetails`,
  `upsertBikeParkDetails` (URL, `on_conflict`, merge-duplicates header,
  body has `status_hint: null` and no `rules`), `setSpotWebsite` (RPC body, error surfaced).
- `spotWebsite.test.ts` — normalisation/validation parity with the RPC.
- `trails.test.ts` — symptom tests, mocking only `fetch`:
  `getTrailBySlug` for a bikepark returns `opening_hours` and
  `trail_description` from `bike_park_details` and `bakedTrailDetails()` of
  that result exposes them; a trail still merges `trail_details`;
  `getTrailById` for a bikepark does the same.
- `BikeParkDetailsEditor.test.ts` — only the bikepark fields render (no
  rain/night/access/rules); save payload shape; website RPC called only when
  changed; legacy `unknown` status renders unselected.
- `SpotInvitationCodes.test.ts` — list/create behaviour preserved after the
  extraction.
- `architecture.test.ts` — `SpotManagerApp.vue` references
  `SPOT_CAPABILITIES` and contains no `=== 'bikepark'`/`=== 'dirtpark'`.
- `tests/spotmanager.spec.ts` (Playwright, one case): admin sees a bikepark
  with its badge, opens it, sees Spot-Details and Parkplätze but no
  Touren/Trails, and the bikepark editor (not the trail editor).
- SQL: no pgTAP in this repo. The plan includes a verification script run
  against a **local** `supabase start` database (anon cannot write
  `bike_park_details`; trailcrew can write only an assigned park; unassigned
  trailcrew cannot; `set_spot_website` rejects non-editors and bad URLs;
  `redeem_invitation` succeeds for a park id; unknown spot id rejected).

## Risks / open items

- **`dirt_park_details` keeps the same anon-write hole** (anon INSERT/UPDATE
  `USING (true)`). Out of scope for the bikepark feature, but independent of
  it; recommend locking it in its own small migration soon.
- **`invitation_codes` INSERT policy** is not in any migration (live DB
  only). SpotManager already creates codes for trails, so a `can_edit_spot`-
  style policy is assumed; verify it accepts park ids before relying on it.
- **Edge function `.single()`** returns 500 for a bikepark without a details
  row (frontend falls back to empty details). Harmless; a `.maybeSingle()`
  follow-up belongs in `../trailradar-backend`.
- **Cold-loaded map data**: `url` on the map's trail list may be baked at
  build time; the detail page reads it live. Not changed here.
- **Field `opening_hours_text`** exists on `SpotDetailsRow` but has no input
  in the trail Spot-Details editor today — pre-existing, left alone.
