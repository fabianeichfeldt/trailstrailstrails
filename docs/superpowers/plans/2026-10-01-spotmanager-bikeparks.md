# Implementation plan: SpotManager manages bikeparks

Date: 2026-10-01
Spec: `docs/superpowers/specs/2026-10-01-spotmanager-bikeparks-design.md`

(No `writing-plans` skill is installed in this environment — written directly,
same structure as the other plans in this folder.)

## Before starting

- Per CLAUDE.md, implement in a **new worktree** (this plan and its spec are
  uncommitted files in the primary checkout). A fresh worktree needs `npx nuxt prepare`, and Playwright silently
  reuses the primary checkout's `:3000` dev server — stop it or use another
  port, or the e2e step tests the wrong code (see memory: worktree test traps).
- Spec §6 is decided: the bikepark editor clears the stale `status_hint` on save.
- Commit at the end of each step. Run `npm test` after every step touching
  `app/`. Write the failing test first for every step marked **TDD**.

## Deploy order (matters)

1. Apply the migration (Step 1) to production **first**.
2. Then deploy the frontend. The reverse order breaks bikepark saves (missing
   column / old RLS), though public reads degrade safely (a failed
   `bike_park_details` select yields empty details, like today).

---

## Step 1 — Migration

New file: `supabase/migrations/20261001120000_spotmanager_bikeparks.sql`

```sql
-- SpotManager for bikeparks: park-aware spot checks, bikepark details write
-- access via can_edit_spot(), and a column-safe website setter.

-- 1. One existence check across the three spot tables.
CREATE OR REPLACE FUNCTION public.spot_exists(p_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM trails WHERE id = p_id)
      OR EXISTS (SELECT 1 FROM parks WHERE id = p_id)
      OR EXISTS (SELECT 1 FROM dirt_parks WHERE id = p_id)
$$;

-- 2. trailcrew_spots / invitation_codes pointed at trails(id) only, which
--    blocked assigning parks. Replace the FKs with a trigger over all types.
ALTER TABLE public.trailcrew_spots  DROP CONSTRAINT trailcrew_spots_spot_id_fkey;
ALTER TABLE public.invitation_codes DROP CONSTRAINT invitation_codes_spot_id_fkey;

CREATE OR REPLACE FUNCTION public.check_spot_exists() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT spot_exists(NEW.spot_id) THEN
    RAISE EXCEPTION 'unknown spot %', NEW.spot_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trailcrew_spots_spot_exists
  BEFORE INSERT OR UPDATE OF spot_id ON public.trailcrew_spots
  FOR EACH ROW EXECUTE FUNCTION public.check_spot_exists();
CREATE TRIGGER invitation_codes_spot_exists
  BEFORE INSERT OR UPDATE OF spot_id ON public.invitation_codes
  FOR EACH ROW EXECUTE FUNCTION public.check_spot_exists();

-- 3. bike_park_details: description column, status guard, real RLS.
ALTER TABLE public.bike_park_details
  ADD COLUMN IF NOT EXISTS trail_description text,
  ADD CONSTRAINT bike_park_details_description_len
    CHECK (trail_description IS NULL OR char_length(trail_description) <= 2000),
  ADD CONSTRAINT bike_park_details_status_values
    CHECK (status IS NULL OR status IN ('open','closed','limited','unknown')) NOT VALID;

-- Anyone with the public anon key could write these (USING (true)).
DROP POLICY "set"    ON public.bike_park_details;
DROP POLICY "update" ON public.bike_park_details;

CREATE POLICY "insert own scope" ON public.bike_park_details
  FOR INSERT TO authenticated WITH CHECK (can_edit_spot(id));
CREATE POLICY "edit own scope" ON public.bike_park_details
  FOR UPDATE TO authenticated, service_role
  USING (can_edit_spot(id)) WITH CHECK (can_edit_spot(id));

-- 4. Website setter. A function rather than an UPDATE policy: RLS cannot
--    restrict columns, and a policy would let trailcrew rewrite
--    name/coordinates/approved on the base rows.
CREATE OR REPLACE FUNCTION public.set_spot_website(p_spot_id text, p_url text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_url text := coalesce(btrim(p_url), '');
BEGIN
  IF NOT can_edit_spot(p_spot_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_url <> '' AND (v_url !~* '^https?://\S+$' OR char_length(v_url) > 500) THEN
    RAISE EXCEPTION 'invalid_url';
  END IF;
  UPDATE trails SET url = v_url WHERE id = p_spot_id;
  IF NOT FOUND THEN UPDATE parks SET url = v_url WHERE id = p_spot_id; END IF;
  IF NOT FOUND THEN UPDATE dirt_parks SET url = v_url WHERE id = p_spot_id; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_spot'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.set_spot_website(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_spot_website(text, text) TO authenticated;
```

Verify the policy names against the live schema before applying
(`"set"` / `"update"` on `bike_park_details`, from the 2026-05-14 dump).

Also add `scripts/verify-bikepark-rls.sql` — a script to run against a
**local** `supabase start` database, never production, asserting:
- anon `INSERT`/`UPDATE` on `bike_park_details` is rejected;
- admin and an assigned trailcrew user can upsert a park's details; an
  unassigned trailcrew user cannot;
- `set_spot_website` rejects a non-editor (`42501`), `javascript:` URLs and
  >500 chars, and updates the right table for a trail and a park;
- `INSERT INTO trailcrew_spots` with a park id succeeds, with an unknown id
  fails (`foreign_key_violation`);
- `redeem_invitation` with a park-spot code grants trailcrew + the assignment.

Regenerate `app/types/database.types.ts` afterwards (command in CLAUDE.md,
run it yourself — the file is gitignored).

Commit: `Allow bikepark management in the database`

## Step 2 — Spot types (**TDD**)

1. `app/spot_manager/spotTypes.test.ts`: every `anyTrailType` has an entry;
   `manageable` is true only for `trail` and `bikepark`; `gpx` only for
   `trail`; `details` is `'trail' | 'bikepark' | null`. Fails: module missing.
2. `app/spot_manager/spotTypes.ts` exactly as in spec §2 (pure, imports only
   the `anyTrailType` type).

Commit: `Add per-type SpotManager capability map`

## Step 3 — Spot list API (**TDD**)

In `app/spot_manager/Api.test.ts` (existing `fetch` stub helpers), replace/extend
the `getManageableSpots` tests first:
- admin → requests `trails` and `parks` (not `dirt_parks`), merges, tags
  `type`, sorts by name, includes `url`;
- trailcrew → `trailcrew_spots?select=spot_id&user_id=eq.<id>`, then
  `id=in.(…)` per manageable table; assert **no** `trails(` embed in any URL;
- trailcrew with no assignments → exactly one request;
- a request failing surfaces an error.

Then implement in `Api.ts`: `SpotRow.type`/`url`, per-table queries driven by
`SPOT_CAPABILITIES` (`manageable` + `table`), shared row-to-`SpotRow` mapper.

Commit: `List bikeparks in the SpotManager spot list`

## Step 4 — Bikepark details + website API (**TDD**)

Tests first in `Api.test.ts`:
- `getBikeParkDetails(id)`: GET `bike_park_details?id=eq.<id>&select=…&limit=1`,
  returns the row or `null`.
- `upsertBikeParkDetails(row, jwt)`: POST to
  `bike_park_details?on_conflict=id`, `Prefer` contains
  `resolution=merge-duplicates`, body contains exactly `id`, `status`,
  `opening_hours`, `trail_description`, `status_hint` (always `null`),
  `last_update` (no `rules`).
- `setSpotWebsite(id, url, jwt)`: POST `rpc/set_spot_website` with
  `{ p_spot_id, p_url }`; a non-ok response throws with the server text.

New `app/spot_manager/spotWebsite.test.ts` then `spotWebsite.ts`:
`normalizeWebsiteUrl` trims, `''` for blank, rejects non-http(s) schemes and
length > 500 (parity with the RPC), does not silently prepend a scheme.

Then implement `getBikeParkDetails`, `upsertBikeParkDetails`,
`setSpotWebsite`, `BikeParkDetailsRow`.

Commit: `Add bikepark details and website SpotManager API`

## Step 5 — Public read path (**TDD**, symptom tests)

In `app/communication/trails.test.ts`, mocking only `fetch` (see the existing
`getTrailBySlug` cases):
- bikepark slug → result contains `opening_hours` and `trail_description` read
  from the mocked `bike_park_details` response, and `bakedTrailDetails(result)`
  exposes both;
- trail slug → still merges `trail_details` (regression);
- `getTrailById` for a bikepark → same as the slug case; assert it fetches
  details only after resolving the type.

Implement `SPOT_DETAILS_SOURCE` in `app/communication/trails.ts`; make
`getTrailById` two-phase.

Commit: `Show bikepark details on the spot page`

## Step 6 — Extract shared invitation-codes section (**TDD**)

Characterisation test first, `SpotInvitationCodes.test.ts` (mock
`~/communication/invitations`): lists codes with used/open badges; "Code
erstellen" creates then reloads and shows the new code; an error is surfaced.
Then create `SpotInvitationCodes.vue` (props: `spotId`, token/user getters or
the auth store) by moving the block and its handlers out of
`SpotManagerApp.vue` (`invitationCodes`, `generateInvCode`, `loadInvCodes`,
`formatInvDate`), and use it in the trail editor. Behaviour must not change.

Commit: `Extract SpotInvitationCodes from SpotManagerApp`

## Step 7 — Bikepark editor + website field (**TDD**)

Tests first, `BikeParkDetailsEditor.test.ts` (mount like
`ParkingEditor.test.ts`, mock `~/spot_manager/Api`):
- renders status Offen/Gesperrt, hours, description, website, invitation codes;
  renders **no** rain/night/season/access/rules/affected-trails;
- legacy `unknown`/null status: neither option selected;
- save sends the exact payload from Step 4, including `status_hint: null`
  (spec §6) even when the loaded row had a legacy hint;
- website RPC is called only when the field changed, with the normalised
  value; an invalid URL blocks save with an inline message;
- description > 2000 chars is blocked.

Then create `SpotWebsiteField.vue` and `BikeParkDetailsEditor.vue` (emits
`saved`/`cancel`, props: `spot`, `details`, `jwt`), reusing `sd-*`/`sm-*`
classes from `spotmanager-shared.css`.

Commit: `Add bikepark details editor`

## Step 8 — Wire SpotManagerApp (**TDD** for the invariant)

1. `architecture.test.ts`: `SpotManagerApp.vue` imports/uses
   `SPOT_CAPABILITIES` and has no `=== 'bikepark'` / `=== 'dirtpark'`
   (fails now).
2. `SpotManagerApp.vue`:
   - type badge in picker rows;
   - `openSpot`: skip trails/tours when `!gpx`; load details by `details`
     kind (`getSpotDetails` vs `getBikeParkDetails`);
   - list view: wrap Touren and Trails sections in `v-if="gpx"`;
   - banner subtitle + status dot by details kind;
   - new `View` value `'bikepark-details'`, `BikeParkDetailsEditor` mounted
     for it, `stepBack` → `'list'`, breadcrumb "Spot-Details";
   - trail editor: add `SpotWebsiteField`; `saveDetails` calls
     `setSpotWebsite` when changed (seeded from `SpotRow.url`).
3. Mobile pass (360px and 768px): picker badge wraps, new editor scrolls in the
   bottom sheet, touch targets ≥ 44px, no horizontal scroll.

Commit: `Manage bikeparks in SpotManager`

## Step 9 — E2E (one case)

`tests/fixtures.ts`: add `parks` and `bike_park_details` route mocks (no
production calls). `tests/spotmanager.spec.ts`: admin signs in, sees a
bikepark with its "Bikepark" badge, opens it, sees Spot-Details and Parkplätze,
sees no Touren/Trails, and the bikepark editor opens (not the trail editor).
Stop any other dev server on `:3000` first.

Commit: `Cover bikepark SpotManager flow in e2e`

## Step 10 — Verify before reporting done

- `npm test`, `npm run lint:arch`, `npm run test:e2e` (touches auth/role and
  spot flows).
- `npm run verify:static-build` (touches trail/spot data fetching; needs real
  Supabase creds, takes minutes).
- Run `scripts/verify-bikepark-rls.sql` against a local Supabase.
- Manual, against a real bikepark: map-panel status/opening hours reflect a
  saved edit (edge function `select('*')` path); detail page shows
  "Allgemeine Infos"; closing a park shows the intended status text (see
  spec §6); website link appears in the hero; invite code for a park redeems.
- Confirm `invitation_codes` INSERT policy accepts a park id (live DB only).

## Follow-ups (not in this change)

- Dirtparks: add `dirt_park_details` columns/RLS, a `details` kind, flip
  `manageable`.
- Lock `dirt_park_details` anon writes (same hole, own migration).
- `.maybeSingle()` in `bike-parks-details/get.ts` (`../trailradar-backend`).
- Park photos/likes/clicks: replace the `trails`-only FKs.
