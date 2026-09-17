# Start-page searchbar — design

Date: 2026-09-17
Status: approved, not yet implemented
Branch: `worktree-feat+start-page-searchbar`

## Goal

Put a working searchbar on the landing page (`app/pages/index.vue`) that is optically
identical to the map searchbar and behaves the same way. It replaces the decorative
`.fake-searchbar` pill inside the map teaser.

"Optically identical" is a maintenance property, not a one-off pixel match: both places
render the *same component*, so the two cannot drift apart.

## Current state

- `app/components/map/SearchBar.vue` is map-only. It is absolutely positioned over the
  Leaflet canvas and emits `openTrail(id)` / `flyTo(lat, lon)`, which `app/pages/map.vue`
  wires to the map handlers returned by `useTrailMap`.
- It searches two sources: `useTrailsStore()` (local fuzzy name scoring over trails,
  bikeparks, dirtparks) and Nominatim (DACH first, worldwide as fallback).
- `trailsStore.fetchAll()` is called from exactly one place, `useTrailMap.ts:492`. The
  landing page therefore holds **no** spot data today.
- `/map?trail=<id>` and `/map?fly=<lat>,<lng>` are already implemented in `map.vue`
  (`onMapReady`), so the landing page has ready-made navigation targets.
- Font Awesome is a global CSS entry in `nuxt.config.ts`, so the magnifier icon works
  outside the map page.
- `SearchBar.vue` still ships a `#search-toggle` button that is `display: none` with a
  comment saying it is never shown. It is dead and gets removed.

## Decisions

| Decision | Choice |
|---|---|
| Placement | Inside the map teaser, where the fake searchbar sits today |
| On select | Navigate to the map — spot → `/map?trail=<id>`, place → `/map?fly=<lat>,<lon>` |
| Data loading | Lazy: spots are fetched on first focus, not on page load |
| Code sharing | One component with a `variant` prop + an extracted search composable |
| Dead mobile toggle | Removed |

## 1. Teaser restructure

The teaser cannot host an input as it stands. Three blockers:

1. The whole teaser is wrapped in `<NuxtLink to="/map">`. An `<input>` inside an `<a>` is
   invalid HTML, and clicks in the input area navigate away.
2. `.map-cta-overlay` is `inset: 0` at `z-index: 3`, above the fake searchbar's `z-index: 2`.
   It would swallow every click aimed at the searchbar.
3. `.map-preview` is `overflow: hidden` at a fixed `340px`. The results dropdown would be
   clipped after roughly two rows.

Target structure:

```
section.map-teaser-section
└── div.map-teaser-wrap             max-width: 780px, width: 100%, position: relative
    ├── div.map-teaser              (was NuxtLink) chrome + preview, overflow: hidden
    │   ├── div.map-chrome
    │   └── div.map-preview
    │       ├── .marker …
    │       └── NuxtLink.map-cta-overlay  to="/map", inset: 0, z-index: 3
    └── div.teaser-search-slot      absolute, top: var(--map-chrome-height), height: 0
        └── SearchBar variant="teaser"  absolute, top center of the slot, z-index: 10
```

**Correction made during implementation.** An earlier draft of this spec put the
searchbar directly in the wrap at `top: 10px`. That is wrong: the wrap starts at the fake
browser chrome, not at `.map-preview`, so a literal `top: 10px` lands the pill on top of the
"trailradar.org/map" chrome bar — contradicting this spec's own "exactly where the dummy pill
sits today". `MapTeaser` therefore interposes `.teaser-search-slot`, a zero-height box offset
by `--map-chrome-height` (36px, also pinned on `.map-chrome` so the two cannot drift).
`SearchBar` keeps a variant-agnostic `top: 10px` relative to its containing block and never
learns that the fake chrome exists. The slot is zero-height so it can never intercept a click
meant for the CTA overlay.

`.map-teaser-wrap` takes over the sizing the old `.map-teaser-link` anchor had
(`max-width: 780px; width: 100%`) and becomes the positioned ancestor. Positioning against
the wrap rather than the section matters: the section is full-bleed with `1rem` padding, so
a percentage width measured against it would be wrong on every viewport.

- The whole-teaser link becomes the overlay link. Clicking anywhere on the preview still
  goes to `/map`, so the existing affordance survives; only the chrome bar stops being
  clickable, which is invisible to users.
- The searchbar is a **sibling of** `.map-teaser`, so it lives outside the
  `overflow: hidden` box and its dropdown expands freely over the section below — the same
  way it overlays the real map.
- `.fake-searchbar` and its CSS are deleted.
- The green "Zur Karte →" button and the dark scrim stay as they are.

Visually nothing changes until the user interacts: a white pill at the top center of the
map preview, exactly where the dummy pill sits today.

## 2. Files

| File | Change |
|---|---|
| `app/communication/places.ts` | **new** — `searchPlaces(q)`, the Nominatim call lifted out of the component. DACH (`de,at,ch`) first, worldwide fallback, `[]` on failure. |
| `app/composables/useSpotSearch.ts` | **new** — query state, 250 ms debounce, name scoring, group assembly, keyboard selection index, stale-query guard. All logic currently inline in `SearchBar.vue`. |
| `app/stores/trails.ts` | add `ensureLoaded()` — no-ops when already loaded, returns the in-flight promise when a fetch is running. |
| `app/components/map/SearchBar.vue` | becomes presentational. New prop `variant: 'map' \| 'teaser'` (default `'map'`). Emits unchanged. `#search-toggle` removed. |
| `app/components/MapTeaser.vue` | **new** — teaser markup + CSS extracted from `index.vue`; hosts the searchbar and owns navigation. |
| `app/pages/index.vue` | teaser block and its CSS replaced by `<MapTeaser />`. |

### `variant` prop scope

The prop switches **positioning CSS only**:

- `variant="map"` — today's rules verbatim, including the map-only part of the
  `@media (max-width: 600px)` block that offsets for the dark mobile top bar
  (`left: 64px; right: 60px`, and the `.search-results { margin-left: -52px }` hack that
  widens the dropdown back out past that offset).
- `variant="teaser"` — `position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  width: min(380px, calc(100% - 28px))`, measured against `.map-teaser-wrap`.

The existing mobile media query is split rather than duplicated: the *appearance* rules it
currently carries (`.search-input-row { height: 44px; border-radius: 8px }`,
`.search_input { font-size: 14px }`) move to a shared block that applies to both variants,
and only the positioning rules stay map-only. Without this split the teaser input would sit
at 15px on mobile while the map's sits at 14px.

`.search-input-row`, `.search-results`, `.search-result-item`, `.search-result-icon`,
`.search-result-text`, `.search-result-name`, `.search-result-sub` and
`.search-result-separator` are shared verbatim by both variants. This is what makes the two
optically identical by construction.

### Navigation

No navigation prop. `SearchBar` stays emit-only and knows nothing about routing;
`MapTeaser` handles the existing emits:

```ts
function onOpenTrail(id: string) { router.push(`/map?trail=${id}`) }
function onFlyTo(lat: number, lon: number) { router.push(`/map?fly=${lat},${lon}`) }
```

`map.vue` keeps its current handlers unchanged. A picked spot therefore flies the camera to
the spot and zooms in, exactly as picking it in the map's own searchbar does.

**Correction made during implementation.** An earlier draft of this spec said `?trail=`
"opens its panel". It does not — `openTrail()` flies the live map and zooms, staying on
`/map`; only clicking a spot's own marker navigates to its detail page. See the comment in
`app/pages/map.vue` and `tests/trail-open.spec.ts`. The behavioural requirement is unaffected:
picking from the landing page is identical to picking from the map.

## 3. Lazy data loading

`useSpotSearch` exposes an `onFocus` handler that calls `trailsStore.ensureLoaded()`, and
`runSearch` awaits `ensureLoaded()` again before scoring so that paths which never fire
focus still work.

- A visitor who never touches the searchbar costs zero extra Supabase egress and no LCP
  regression — consistent with `docs/db-egress-reduction-plan.md`.
- First focus warms the same three SW runtime caches (`supabase-rest-trails`,
  `supabase-rest-parks`, `supabase-rest-dirtparks`) the map reads later, so a visitor who
  does click through reaches the map with its data already cached.
- `ensureLoaded()` dedupes, so focus + first keystroke cannot fire two fetches.
- `useTrailMap.ts` keeps its unconditional `fetchAll()` call. Out of scope here.

## 4. Layering

The change respects the documented dependency layers:

```
communication/places.ts   → no store, no composable, no map imports
composables/useSpotSearch → imports stores/trails only
components/map/SearchBar  → imports the composable
components/MapTeaser      → imports SearchBar, owns routing
pages/index.vue           → imports MapTeaser
```

Moving the Nominatim `fetch` out of the component and into `communication/` is what the
layer rules already ask for; it is currently a raw `fetch` inside a `.vue` file.

## 5. Tests

Vitest throughout, plus one Playwright case for the cross-page navigation.

- **`app/communication/places.test.ts`** — a DACH hit returns without a second request;
  an empty DACH response falls back to the worldwide query; a rejected `fetch` returns `[]`.
- **`app/composables/useSpotSearch.test.ts`** — scoring order (exact 100 > prefix 80 >
  substring 60, non-match dropped); the 5-result cap; group assembly with
  the right labels and icons per spot type; the stale-query guard (a slow place response for
  an abandoned query must not overwrite newer results); `ensureLoaded()` is awaited before
  scoring; queries under 2 characters produce no results.
- **`app/components/MapTeaser.test.ts`** — the regression test for the feature itself.
  Mount `MapTeaser` with `fetch` mocked at the network boundary only, type `Flow`, click the
  result, assert `router.push` was called with `/map?trail=<id>`. Second case: a place result
  pushes `/map?fly=<lat>,<lon>`. Third case: the searchbar element is **not** a descendant of
  any `<a>` — this is the assertion that locks in the section-1 restructure.
- **`app/components/map/SearchBar.test.ts`** — both variants render identical DOM apart from
  the variant class, asserted over the shared class names and `data-testid`s. This is the
  structural guarantee behind "optically identical".
- **`tests/search.spec.ts`** — one added Playwright case: open `/`, type into the teaser
  searchbar, click the result, assert the URL is `/map?trail=…` and the spot panel opens.
  `tests/fixtures.ts` already stubs Nominatim empty for every page, so only local spot
  results appear.

No new architecture invariants are introduced, so `app/architecture.test.ts` needs no change.

## Mobile

- Teaser variant: `width: min(380px, calc(100% - 28px))` of the teaser wrap, 44px input row,
  14px input font — the same touch target and type size the map searchbar uses.
- The viewport meta (`nuxt.config.ts:71`) sets no `maximum-scale`, so iOS zooms in when a
  sub-16px input takes focus. That already happens on the map searchbar today and the teaser
  inherits it, by design — matching the map is the requirement. Bumping both to 16px is a
  separate call and is out of scope here.
- The dropdown overlays the features section below rather than being clipped, and is reachable
  by touch because it sits above the CTA overlay link.
- The landing page is reachable cold (shared link, home-screen icon), but it *is* the app's
  entry point, so no back affordance is needed. Navigating to `/map` from it pushes history,
  so the map's own back handling is unaffected.

## Known dead code carried over

`trailScore()`'s fourth tier — `n.split(/\s+/).some(w => w.startsWith(qq))` returning 40 — is
unreachable. Any name containing a word that starts with the query also satisfies
`n.includes(qq)`, which returns 60 first. This is pre-existing behaviour from the original
`SearchBar.vue`, carried over verbatim rather than changed, since altering it would change
result ranking and is not what this task is for. The unit test asserts the three reachable
tiers plus the drop case. Removing the branch is a separate, behaviour-neutral cleanup.

## Out of scope

- Any change to how the map page itself searches or navigates.
- Search on other content pages.
- Recent-searches / history, search analytics, geolocation-biased ranking.
