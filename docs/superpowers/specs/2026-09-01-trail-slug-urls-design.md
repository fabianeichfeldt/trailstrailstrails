# Trail detail URLs: id → name-slug transition

**Status:** proposal / plan
**Date:** 2026-09-01
**Scope:** `/trails/[slug]` detail pages only. Region pages under the same route are unaffected.

---

## 1. Goal

Today a spot detail page is `/trails/b3060ec3-ba3b-4b18-81d2-491c49aac727/`. The
UUID carries no keywords, no readability, no click-through appeal in a SERP or a
shared link. We want `/trails/bierstadttrails-kulmbach/`.

Requirements:

1. **Human/SEO-friendly slugs** derived from the spot name, German-aware
   (`ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`), matching the convention the region slugs
   already use (`muenchen`, `koeln`, `fraenkische-schweiz`).
2. **Backwards compatibility** — every existing `/trails/<id>/` URL that is
   indexed or shared must keep working and send a **301** to the new slug URL.
3. **Handle name changes** — trailcrew can rename a spot in SpotManager. A
   rename regenerates the slug; the old slug must 301 to the new one.
4. **Collision-safe** — two spots named "Flowtrail", or a spot whose slug would
   equal a region slug, must still get unique, stable URLs.

Non-goals: changing the primary key (`trails.id` stays), changing region page
URLs, changing the `?trail=<id>` map deep-link param (internal, low value).

---

## 2. Why we do NOT rename `trails.id`

`trails.id` is `text` so renaming is *technically* possible, but it is the FK
target of ~15 tables (`trail_details`, `trail_photos`, `spot_gpx_trails.spot_id`,
`spot_gpx_tours.spot_id`, `parking.spot_id`, `trail_favorites`, `trail_clicks`,
`trail_shares`, `trail_videos`, `trail_details_feedback`, `trailcrew_spots`,
`embed_token_trails.trail_id`, …), plus storage paths
(`trail-photos/<id>/…`, `gpx-files/<id>/…`), plus the embed-token config, plus
every already-shared link. Renaming the key is a high-blast-radius operation for
zero benefit over an added `slug` column.

**Decision:** add a `slug` column. `id` remains the immutable internal key;
`slug` is the public URL token.

---

## 3. Slug generation

### 3.1 Algorithm (`slugify(name)`)

1. Trim, lowercase (locale-independent).
2. German transliteration **first**, before diacritic stripping:
   `ä→ae`, `ö→oe`, `ü→ue`, `ß→ss` (and capitals). This matches the existing
   region slugs and is what German readers expect.
3. NFKD-normalise, strip remaining combining marks (`é→e`, `ñ→n`, `å→a`).
4. Replace every run of non-`[a-z0-9]` with a single `-`.
5. Trim leading/trailing `-`, collapse repeats.
6. Truncate to 60 chars at the last `-` boundary.
7. If the result is empty (name was all punctuation/emoji) → `spot`.

### 3.2 Uniqueness & reserved words

The `/trails/` namespace is shared by **region pages** and **all three spot
tables** (`trails`, `parks`, `dirt_parks`). A slug must be unique across that
whole space.

- **Reserved list:** `Object.keys(regions)` from `build/region.ts` (≈ 45 slugs).
  A generated slug that lands in this set gets the disambiguation suffix
  (see below) even if nothing else collides.
- **Cross-table uniqueness:** enforced by a shared registry table rather than
  three separate unique indexes (see §4.1).
- **Collision suffix:** on collision, append `-2`, `-3`, … The bare slug goes to
  the row with the earliest `created_at` (deterministic; re-running the backfill
  is stable). Example: `flowtrail`, `flowtrail-2`, `flowtrail-3`.

### 3.3 Where generation runs — Postgres, not app code

New spots are created through Supabase **edge functions** (`add-trail`,
`bike-parks`, `dirt-parks`) that are *not in this repo*. SpotManager also writes
spot rows. There is no live app server to centralise slug logic. Putting it in
Postgres covers every write path at once and keeps the prerender build (which
reads straight from the DB) consistent.

- `slugify(text) returns text` — `IMMUTABLE` SQL/plpgsql function.
- `spot_slug_assign()` trigger, `BEFORE INSERT OR UPDATE OF name` on each of
  `trails`, `parks`, `dirt_parks`:
  - compute base slug from `NEW.name`
  - if unchanged from the current row's slug → no-op
  - resolve collisions against the registry (loop appending `-n`)
  - set `NEW.slug`
  - maintain the registry + slug history (see §4).

---

## 4. Schema changes

### 4.1 Migration `NNNN_add_spot_slugs.sql`

```sql
-- slug column on each spot table
alter table public.trails      add column slug text;
alter table public.parks       add column slug text;
alter table public.dirt_parks  add column slug text;

-- one registry across all three tables + regions, so uniqueness and
-- redirect lookups are a single indexed query
create table public.spot_slugs (
  slug        text primary key,
  spot_id     text not null,
  spot_type   text not null check (spot_type in ('trail','bikepark','dirtpark')),
  is_current  boolean not null default true,   -- false = historical, redirect only
  created_at  timestamptz not null default now()
);
create index spot_slugs_spot on public.spot_slugs (spot_type, spot_id);
create index spot_slugs_current on public.spot_slugs (spot_id) where is_current;

-- slugify() + spot_slug_assign() trigger fn here (see §3)

-- backfill: earliest created_at wins the bare slug
-- (done in this migration by iterating rows ordered by created_at)

-- after backfill:
alter table public.trails      alter column slug set not null; -- deferred, see §7
```

Rules the trigger enforces:

- On **insert**: generate slug, insert `spot_slugs(slug, …, is_current=true)`.
- On **name update** that changes the slug: flip the old `spot_slugs` row to
  `is_current=false`, insert the new one as current. Old slug now redirects.
- A historical slug is **never reclaimed** while it exists in `spot_slugs`
  (it stays in the collision check). If an active slug and a historical slug
  ever coincide, `is_current=true` wins the lookup.

### 4.2 Reserved region slugs seeded into the registry

Insert the ~45 region slugs into `spot_slugs` with a sentinel
(`spot_type='region'`, `is_current=true`, `spot_id=slug`) so the collision loop
avoids them automatically and we don't hard-code the list in plpgsql.

### 4.3 Regenerate `app/types/database.types.ts`

Per CLAUDE.md, after the migration:
`npx supabase gen types typescript --project-id ixafegmxkadbzhxmepsd --schema public > app/types/database.types.ts`

---

## 5. Application changes

### 5.1 `app/types/Trail.ts`

Add `slug: string` to `BaseTrail`. All spot payloads now carry it.

### 5.2 `app/communication/trails.ts`

- New `getTrailBySlug(slug: string)` — the primary resolver. Queries
  `trails?slug=eq.`, `parks?slug=eq.`, `dirt_parks?slug=eq.` in parallel, same
  shape as today's `getTrailById`.
- Keep `getTrailById(id)` — used by the legacy fallback (§5.4) and the
  `?trail=<id>` deep link.
- Add `slug` to every `select` that feeds a list the UI links from.

### 5.3 `app/pages/trails/[slug].vue` resolution order

```
1. regions[slug]                    → region page (unchanged)
2. getTrailBySlug(slug)             → trail detail page
3. getTrailById(slug) [legacy]      → if found: navigateTo(`/trails/${found.slug}/`,
                                       { redirectCode: 301, replace: true })
4. otherwise                        → 404 ("Nicht gefunden")
```

- `canonical`, `og:url`, `twitter`, JSON-LD `url` must use the **resolved
  spot's `slug`**, not `route.params.slug` (which could be a legacy id or an
  old slug on a history hit).
- `useAsyncData` key stays `trail-${slug}` — fine with a slug value.
- The Salzburg-bug note (prerendered dynamic routes get `window.location`
  rewritten by the client router) does **not** bite here: the id→slug 301
  happens at the edge before Nuxt boots (§6). The in-app fallback in step 3 is
  only a safety net for ids created after the last deploy — those were never
  indexed, so a soft client redirect is acceptable.

### 5.4 Internal links (all currently use `id`)

| File | Change |
|---|---|
| `app/composables/useTrailMap.ts` (~line 89) | marker click → `router.push(`/trails/${slug}`)` |
| `app/components/trail_detail/SpotDetailNearby.vue` | `/trails/${s.slug}` |
| `app/map/spot_panel/spotPanelShare.ts` | `…/trails/${slug}/` |
| `app/components/trail_detail/SpotDetailHero.vue` | share URL → slug |
| `server/api/trails.get.ts` | add `slug` to `fields` (marker payload) |
| `nuxt.config.ts` `nitro:config` fetch | add `slug` to `spotFields` |
| `cloudflare/embed-worker.js` + `server/routes/_embed/[token].get.ts` | add `slug` to `SPOT_FIELDS` (parity; embed doesn't link out, but keep the mirror honest) |

The map marker payload must carry `slug` so a marker click can navigate without
a round-trip.

### 5.5 `build/nearby.ts` + `public/nearby.json`

`nearby.json` is currently keyed by spot id and `[slug].vue` looks it up by
`route.params.slug`. Re-key the map by **slug**:

- `computeNearbyMap` takes `slug` per spot, keys the output object by slug, and
  each `NearbySpot` entry carries `slug` (for the `SpotDetailNearby` link).
- Update `build/nearby.test.ts`.

### 5.6 Prerender + sitemap (`nuxt.config.ts` `nitro:config` hook)

- Push `/trails/${spot.slug}` instead of `/trails/${spot.id}`.
- Sitemap: emit slug URLs; drop id URLs.
- Region routes unchanged.

---

## 6. The 301 for legacy `/trails/<id>/` URLs

GitHub Pages cannot emit redirects and has no `_redirects` support. The redirect
must live at the **Cloudflare** layer (which already fronts the site). Two
viable mechanisms:

### Option A (recommended): prerendered redirect stubs

After `nuxt generate`, a `nitro:close` hook writes a tiny stub to
`.output/public/trails/<id>/index.html` for every spot:

```html
<!doctype html><html lang="de"><head>
<link rel="canonical" href="https://trailradar.org/trails/<slug>/">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=/trails/<slug>/">
<script>location.replace('/trails/<slug>/')</script>
</head><body>Weiterleitung…</body></html>
```

- ~499 stubs today, trivial size. Also emit stubs for **historical slugs**
  (`spot_slugs where is_current = false`).
- Google treats an instant meta-refresh + canonical as a permanent redirect and
  consolidates ranking signals.
- **Zero new infra, zero CF Worker drift risk** — this repo has been bitten
  twice by the manually-deployed embed Worker drifting (see
  `docs/production-architecture.md`). Not adding a second hand-deployed Worker
  is a real advantage.
- Keep these stubs **out of the sitemap**.

### Option B (SEO-purest): Cloudflare Bulk Redirects

A CI step builds an `id → slug` list (plus historical `slug → slug`) and pushes
it to a Cloudflare **Bulk Redirect List** via the CF API (list + rule, 301,
`preserve query string`). Free plan allows 10k entries; we have ~500.

- True header-level 301.
- Cost: a new CI secret (CF API token), a new script, and the list can drift
  from reality if the push step fails silently — needs a verification step.

### Recommendation

Ship **Option A** with the transition. Revisit Option B only if Search Console
shows the soft redirects aren't consolidating signal after ~4 weeks. The two are
not mutually exclusive.

Either way, the in-app fallback (§5.3 step 3) covers ids too new to have a stub.

---

## 7. Rollout sequence

Each step is independently deployable and safe to pause on.

1. **DB migration** (§4): add `slug` columns nullable, `spot_slugs` registry,
   `slugify()`, trigger, backfill, seed region slugs. Regenerate
   `database.types.ts`. No app behaviour change yet.
2. **Resolver + dual routing**: add `getTrailBySlug`, make `[slug].vue` resolve
   slug-first with id fallback, set canonical to the resolved slug. Deploy.
   → slug URLs now work; id URLs still work; canonical already points at slug.
3. **Switch generated artefacts to slug**: prerender routes, sitemap,
   `nearby.json`, all internal links, marker payload. Add the redirect stubs
   (§6 Option A). Deploy. Submit the new sitemap in Search Console.
4. **Grace period** (~2–4 weeks): watch Search Console for coverage of the new
   URLs and 404s.
5. **Tighten**: `alter column slug set not null` on all three tables once the
   backfill is confirmed complete and the trigger has been live through a full
   deploy cycle.

Rollback: steps 2–3 are pure code reverts; the `slug` column and registry are
additive and harmless if unused.

---

## 8. Tests (per CLAUDE.md: every feature needs one; bug-fixes get a failing test first)

**Unit (vitest — preferred):**

- `slugify()` mirror in TS if we keep a client copy for previews, OR a pgTAP /
  SQL-level test of the DB function. German chars, diacritics, collisions,
  region-slug reservation, empty→`spot`, 60-char truncation.
- `getTrailBySlug` — HTTP shape, three-table lookup, not-found → null.
- `[slug].vue` resolution: region hit, slug hit, legacy-id hit → 301 to slug,
  miss → 404. (component test with mocked communication layer)
- `nearby.ts` — output keyed by slug, entries carry slug.
- sitemap generation — contains `/trails/<slug>/`, contains **no** UUID URLs.
- architecture test: assert nothing in `app/` builds a `/trails/${...id}` link
  (grep-style guard, like the existing `showTrails ? trails` one).

**Static build (`scripts/verify-static-build.mjs`):**

- A real trail page renders at `/trails/<slug>/`.
- A legacy `/trails/<id>/` path serves the redirect stub with the right
  canonical + refresh target.

**Playwright (`tests/trail-open.spec.ts`, only where vitest can't):**

- Update existing assertions from id URLs to slug URLs.
- Marker click lands on `/trails/<slug>`.
- Old id URL (dev server) → client fallback redirect to slug URL.

---

## 9. Open questions for review

1. **Slug on rename: regenerate (this plan) vs freeze at creation?** This plan
   regenerates + keeps history + 301s, because you called out "changing names"
   as a requirement. Freezing is simpler but means the URL never reflects a
   corrected name. — *Assumed: regenerate.*
2. **Redirect mechanism: Option A (stubs) vs B (CF Bulk Redirects)?** Plan
   recommends A. — *Assumed: A.*
3. **`?trail=<id>` map deep link** — leave as id (this plan) or also accept
   slug? Leaving it limits blast radius. — *Assumed: leave as id.*
4. **Parks / dirt parks** — same slug treatment now (this plan), or trails only
   first? They share the route and the resolver, so doing all three together is
   less code than special-casing. — *Assumed: all three.*
