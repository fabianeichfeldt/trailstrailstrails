# Supabase egress reduction plan

Date: 2026-09-03
Status: proposal — no code changed yet

## Constraints (confirmed with Fabian, 2026-09-03)

1. **Unapproved spots must stay on the map**, rendered grey. No `approved=eq.true`
   row filter anywhere; `approved` stays in every select that feeds a marker.
2. **No deploy-time-static data.** New spots and edited GPX tracks must show up
   without waiting for a redeploy → the `spots.json` / baked-geometry ideas from
   the first draft are **out**. Everything below keeps the data dynamic; the
   levers are payload trimming, the filter-bug fix, a thinned geometry column,
   and cheap change-detection.
3. No per-table egress breakdown available — only aggregate DB egress + storage
   egress in the dashboard. Ranking below is reasoned from payload sizes, not
   measured. Add temporary logging or a one-off `EXPLAIN`/`pg_stat` check to
   confirm before/after.

## Method

Audited every Supabase REST / edge-function call in `app/communication/`,
`app/stores/`, `app/spot_manager/`, `server/`, and `nuxt.config.ts`. For each
call: what rows/columns come back today, what the consuming code actually reads,
and how often the call fires. Ranked by `rows × columns × calls-per-session`.

Schema (from `supabase/migrations/20260514075528_remote_schema.sql`):

| table | heavy columns | notes |
|---|---|---|
| `trails` | — | 12 cols, all small |
| `parks` / `dirt_parks` | — | small |
| `spot_gpx_trails` | **`gpx_points` jsonb**, `trail_description` text | one row = one GPX track, 500–5000 `[lat,lng,ele]` triples ≈ 15–150 KB JSON |
| `spot_gpx_tours` | **`gpx_points` jsonb** | same |
| `trail_details` | `description`, `rules`, `opening_hours` text | 1 row per spot |

`gpx_points` dominates total egress by an order of magnitude.

---

## Findings

### P0-1 — `fetchMultipleSpotGpx` fetches the entire GPX table on every zoom-in  ⚠️ bug

`app/communication/trails.ts:346`

```ts
const idList = spotIds.map(id => encodeURIComponent(id)).join(',')   // computed…
const [tRes, rRes] = await Promise.all([
  fetch(`${REST}/spot_gpx_trails?select=spot_id,name,difficulty,gpx_points,trail_description,closed_from,closed_to,hint`, …),
  fetch(`${REST}/spot_gpx_tours?select=spot_id,name,gpx_points`, …),
])                                                                    // …never used
```

`idList` is built and then discarded — **no `spot_id` filter, no `limit`**. Every
time the map crosses `GPX_ZOOM_THRESHOLD` (`useTrailMap.ts:213`) it downloads
`gpx_points` + `trail_description` for **every trail and every tour in the
database**, not just the handful of visible/uncached spots the caller asked for.
Served `NetworkFirst` (`nuxt.config.ts:241`), so it re-downloads the whole table
on essentially every GPX-view session.

**This is almost certainly the single largest source of egress.**

- Fix (trivial, low risk): actually apply the filter —
  `&spot_id=in.(${idList})` on both fetches. Turns a whole-table scan into
  "visible spots only". Add a matching unit test asserting the URL contains the
  `spot_id=in.` clause (regression guard — the filter was clearly there once in
  intent).
- Same pattern is already correct in `fetchMultipleSpotParking`
  (`trails.ts:403`) — mirror it.

**Status: done** — `perf/gpx-fetch-filter` branch. Filter applied to both
fetches in `fetchMultipleSpotGpx`; 5 new tests in `trails.test.ts`
(`describe('fetchMultipleSpotGpx')`), 2 of which fail on the pre-fix code.

### P0-2 — explicit column list for the marker fetch

`app/stores/trails.ts:26-28` — `fetchAll()` runs `select('*')` on `trails`,
`parks`, `dirt_parks` on every map load (3 requests, all rows).

Columns actually consumed downstream (markers, `filtersStore.apply`, `SearchBar`,
`near_by_trails`, `navigateToSpot`, `createCustomIcon`):
`id, slug, name, latitude, longitude, approved` + `pumptrack, dirtpark`
(dirt_parks only).

Sent but never read over the wire: `url, instagram, creator, creator_id,
visible, spotcheck, created_at`.

Fix: replace `select('*')` with the explicit list. Keeps the data fully
dynamic (constraint 2), ~50% payload cut, ~15 min, no architecture change.
Update `warmSwCaches` (`trails.ts:47`) and the SW `urlPattern` cache keys — the
request URL is the cache key, so the `select=` string must match or the SW
grows a second stale entry.

The remaining payload is small in absolute terms (a few hundred spots × 6 small
columns). Combined with a change-detection gate (P2-1) this stops being a
concern; the GPX calls are where the volume is.

### P0-3 — split `gpx_points` out of the map GPX overview

Even after P0-1, the overview pulls full 3D point arrays for every visible spot
and re-pulls them every session (`NetworkFirst`). But the overview only renders
2D polylines — elevation (`p[2]`) is dropped immediately in `useTrailMap.ts`
(`.map(([la, ln]) => [la, ln])`). It's downloading 3-value triples at full GPS
resolution to draw a thumbnail-scale line.

Since static baking is out (constraint 2), keep it dynamic but make the payload
small:

1. **Add a thinned 2D geometry column** — `spot_gpx_trails.overview_points`
   (jsonb, `[lat,lng]` pairs, RDP-thinned to ~1 point / 25–50 m). Populate it
   from the SpotManager on GPX upload (RDP already exists —
   `app/spot_manager/GpxProcessor.ts`) and backfill existing rows with a one-off
   migration script. Stays up to date the moment a track is edited.
2. The overview query becomes
   `spot_gpx_trails?select=spot_id,name,difficulty,overview_points,closed_from,closed_to,hint&spot_id=in.(…)`
   — typically 10–20× smaller than `gpx_points`.
3. `trail_description` (tooltip, truncated to 150 words in the client) — move to
   a per-spot fetch on hover, or store a pre-truncated `description_short` on the
   row. Don't ship the full text for every trail up front.

Full-resolution `gpx_points` are still fetched per-spot by `getSpotGpxData` when
the spot panel actually opens (`spotPanel.ts:114`) — that stays as-is.

Alternative if a schema change is unwelcome: a Postgres RPC / edge function that
returns thinned geometry computed on the fly (`ST_Simplify`-style on the jsonb).
Simpler schema, more CPU per request, still small egress. The column is the
cleaner call.

### P1-1 — trim detail-page selects

`getTrailBySlug` (`trails.ts:110`) fires on client-side nav to a spot page
(the landing hit uses the SSR payload, no refetch): 3× `select=*` by slug +
`trail_details?select=*` + `trail_photos?select=id,url`.

- 3-table slug probe: 1 row each, cheap — trim to
  `id,slug,name,latitude,longitude,approved` (+ dirt cols) anyway.
- `trail_details?select=*`: list the columns the panel renders instead of `*`.
- `getTrailById` (`trails.ts:68`) is the legacy-numeric-id fallback only — rare,
  leave for now but same column trim applies.

### P1-2 — `getSpotGpxData` column trim

`trails.ts:252` — `spot_gpx_trails?select=*` / `spot_gpx_tours?select=*` filtered
to one `spot_id`. Bounded (one spot) so lower priority, but `select=*` pulls
`filename` and (for trails) `duration_minutes` which the mapper never reads.
List explicit columns.

### P1-3 — delete dead `select=*` code

Only referenced by their own tests — no runtime callers:

- `getTrails()` — `trails.ts:22`, `trails?select=*`
- `getTrailsByUserId()` — `trails.ts:42`
- `getFavoriteTrails()` — `trails.ts:33`, `trail_favorites?select=*,trails(*)`
- `getPhotosByUserId()` — `trails.ts:155`, `trail_photos?select=*,trails(name)`

Removing them + their tests cuts no live egress but removes `select=*` liability
and keeps the audit surface small.

### P2-1 — cheap change-detection instead of unconditional refetch

Every Supabase rule in `nuxt.config.ts:210-249` is `NetworkFirst`, so for an
online user the cache never prevents a request — it's purely an offline
fallback. Every map load re-downloads the full marker list and (after P0-3) the
full thinned-geometry set even when nothing changed.

Constraint 2 rules out a time-based "skip refetch for N hours" gate. What works
instead: a **version probe**. Add `updated_at timestamptz` (with a
`moddatetime` trigger) to `trails` / `parks` / `dirt_parks` /
`spot_gpx_trails` / `spot_gpx_tours`, then:

1. On map load, one tiny query per table:
   `?select=updated_at&order=updated_at.desc&limit=1` (plus a row count, or a
   dedicated `spots_version()` RPC returning `max(updated_at) || count(*)` for
   all tables in one call — cheapest).
2. Compare against the value stored alongside the cached payload in
   `localStorage` / IndexedDB. Unchanged → serve the cache, no full fetch.
   Changed → fetch, update the stored version.

This keeps the map genuinely up to date (any insert/edit/approve bumps the
version → refetch on the next load) while collapsing the steady-state egress of
a returning visitor to a few hundred bytes. Needs the `updated_at` columns,
which also make P0-3's backfill and any future incremental sync possible.

Also: once P0-3 lands, the SW `spot_gpx_*` rule (`nuxt.config.ts:241`) caches
both the heavy per-spot `getSpotGpxData` response and the light overview
response under one `cacheName` with `maxEntries: 200` — they'll evict each
other. Give the overview query its own cache rule / name.

### P2-2 — edge functions `*-details`

`getTrailDetails` (`trails.ts:170`) hits `FUNCTIONS/{trail,bike-parks,dirt-parks}-details`,
cached `supabase-functions` `NetworkFirst`, 5-min in-memory TTL. Measure the
response payloads before touching — likely fine, but confirm they're not
returning `gpx_points` or full photo rows.

### OK as-is

- `app/communication/activity.ts` — narrow columns + `limit` already. ✓
- `app/communication/comments.ts`, `invitations.ts` — scoped selects. ✓
- `fetchMultipleSpotParking` — filtered + narrow. ✓
- `app/spot_manager/Api.ts` — `select=*` in places, but trailcrew/admin-only and
  low volume; `gpx_points` genuinely needed for editing. Leave.
- `server/api/trails.get.ts`, `nuxt.config.ts` prerender hook — build time only.
- `server/routes/_embed/[token].get.ts` — the non-wildcard path already filters
  by `idList` (`:142`). The **wildcard** path (`:97-98`) fetches all `gpx_points`
  by design (a wildcard token shows every spot), so it's not the same bug as
  P0-1 — but it's still a heavy per-request payload on the CF Worker and would
  benefit directly from P0-3's thinned `overview_points` column. Fold it into
  PR 2, not PR 1.

---

## Suggested order

**PR 1 — small, safe, high impact (each change gets a test per the repo mandate):**

| # | Change | Effort | Egress impact |
|---|---|---|---|
| 1 | P0-1 filter `fetchMultipleSpotGpx` by `spot_id` | XS | very high |
| 2 | P0-1 same fix in `_embed/[token]` wildcard path (`:97`) | XS | high (embed traffic) |
| 3 | P1-3 delete dead `select=*` functions + their tests | XS | none (hygiene) |
| 4 | P0-2 explicit columns in `fetchAll` (+ `warmSwCaches` / SW keys) | S | medium |
| 5 | P1-1 / P1-2 column trims on detail + panel fetches | S | low–medium |

**PR 2 — thinned geometry (needs a design pass + migration):**

| # | Change | Effort | Egress impact |
|---|---|---|---|
| 6 | P0-3 `overview_points` column, SpotManager populates on upload, backfill script | L | very high |
| 7 | P0-3 overview query switches to `overview_points`; dedicated SW cache rule | M | — |

**PR 3 — change-detection (needs `updated_at` columns + triggers):**

| # | Change | Effort | Egress impact |
|---|---|---|---|
| 8 | P2-1 `updated_at` + `moddatetime` triggers on the 5 tables | M | — |
| 9 | P2-1 `spots_version()` RPC + client version-gate on marker/overview fetch | M | high (repeat visits) |

---

## Storage egress (separate dashboard line)

Storage egress is the `trail-photos` bucket + raw GPX files (`gpx_url`). Photos
are already `CacheFirst` (`nuxt.config.ts:285`) so repeat views are free; check
whether `photos.ts` upload/resize keeps originals, and whether `gpx_url` files
are actually downloaded anywhere client-side (the map/panel use `gpx_points`
from the DB, not the stored file — `gpx_url` looks like a "download GPX" link
only). Likely minor; confirm with a quick look at the bucket's byte count vs the
DB egress number before spending time here.

---

## Follow-ups / to confirm

- Measure before/after: no per-table breakdown in the dashboard, so add a
  temporary `console`/logging tap on response `Content-Length` in `http.ts`, or
  read `pg_stat_statements` once, to get a baseline and verify PR 1's impact.
- `getTrailDetails` edge functions (`*-details`) — confirm their payloads don't
  include `gpx_points` or full photo rows before deciding they're fine.
