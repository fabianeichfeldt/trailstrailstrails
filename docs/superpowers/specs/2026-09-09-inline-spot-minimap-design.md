# Inline spot-detail mini-map — design

**Status:** done
**Date:** 2026-09-09
**Branch:** cut a feature branch off `main` (do NOT commit to `main`)

---

## Problem

The full spot-detail page (`app/pages/trails/[slug].vue`) renders its map as an
`<iframe src="/embed/{token}/?…">` pointing at the third-party embed widget
(`app/pages/embed/[token].vue`), which in turn fetches its data from the
`/_embed/{token}` Cloudflare Worker. This is the app embedding itself through a
DB token + an external worker (CLAUDE.md "Decision 9: double-Leaflet-bundle cost
accepted").

Consequences we want gone:

- **No offline.** The Capacitor native shell runs at origin `https://localhost`,
  which has no `/_embed/` worker and (Capacitor's asset server has no
  directory-index fallback) can't serve `/embed/{token}/` from the bundle — it
  returns `index.html`, so the iframe shows the homepage. A planned offline mode
  can never cache an external-origin iframe cleanly.
- Cross-origin `postMessage` fly-to dance between the page and the iframe.
- Hardcoded demo embed token (`a1b2c3d4…`) as a runtime dependency of the app's
  own page.
- `Content-Security-Policy: frame-ancestors *` exposure applied for our own use.
- Double Leaflet map instance / bundle.

## Goal

Render the individual spot's mini-map **inline as a Vue component** on
`[slug].vue`, fed by the data already loaded into `spotPanelStore` (which comes
through the `communication/` REST layer — already covered by the service
worker's `supabase-rest-gpx` / `parking` / `osm-tiles` runtime caches, and by
whatever the future offline-mode persistence layer adds). No iframe, no token,
no worker, no `postMessage` for the spot map.

## Non-goals / scope boundaries

- **Region pages stay on the iframe** (`regionEmbedSrc`, the "all spots in the
  region" wildcard map). That branch loads no spot data and isn't an offline use
  case. Keep the iframe; only apply the interim `EMBED_BASE` fix below so it
  works in the native app online.
- **The third-party embed feature keeps its exact current behaviour** —
  `/embed/[token]` page, `/_embed/[token]` worker, host allowlist, `embed.js`
  snippet, admin token UI. Only its *internal Leaflet rendering* is refactored
  onto the shared module.
- No new Supabase endpoints. No schema changes.

---

## Decisions (from planning)

| Question | Decision |
|---|---|
| Region maps | Keep as iframe for now (interim `EMBED_BASE` gate only). |
| Code sharing | Extract shared `app/map/miniMap.ts`; refactor `embed/[token].vue` onto it. |
| Interaction | Keep gesture-guarded pan/zoom (`leaflet-gesture-handling`). Clicking a trail/tour polyline selects that item (same as clicking its Touren/Trails row). |

---

## Part 0 — interim fix (small, ship first, separate commit)

So the native app's spot map works **online** immediately and the region iframe
isn't broken, before the inline work lands:

In `app/pages/trails/[slug].vue`:

```ts
// '' in dev/E2E (same-origin dev server) and in the prod web/PWA build
// (served from trailradar.org — still same-origin). The Capacitor native
// shell (origin https://localhost) is the only case needing an absolute
// URL: no local /embed/{token}/ pages, no /_embed/ worker. import.meta.dev
// is a build-time constant, so server and client agree — no hydration
// mismatch on the iframe src.
const EMBED_BASE = import.meta.dev ? '' : 'https://trailradar.org'
```

And the fly-to target origin (still used by the spot iframe until Part 1 removes
it):

```ts
win.postMessage({ type: 'trailradar:flyTo', lat, lng, zoom }, EMBED_BASE || window.location.origin)
```

`app/pages/embed/[token].vue` `onFlyToMessage`: keep the `event.source ===
window.parent` check; **add** an `event.origin` allowlist (`https://trailradar.org`
plus `window.location.origin`) as light hardening now that the parent can be
cross-origin.

Delete/replace `app/pages/trails/embed-iframe-src.test.ts` assertions that only
made sense for the relative form; add one asserting the `import.meta.dev` gate.

> Part 1 removes the spot iframe entirely, so the `postMessage`/`mapIframeEl`
> code deleted there is only *this* interim state. The region iframe keeps the
> `EMBED_BASE` gate.

---

## Part 1 — shared renderer `app/map/miniMap.ts`

New module under `app/map/` (layer rules: may be imported by `pages/`,
`components/`, `composables/`; must NOT import `stores/`, `composables/`, or
`app/map`-external). It owns a Leaflet instance the same way
`embed/[token].vue` does today (client-only, `const L = (await
import('leaflet')).default` inside the caller's `onMounted`).

### Input — a normalized shape

`embed/[token].vue` has `EmbedTrail` (`gpx_trails[].gpx_points`, snake_case);
`spotPanelStore` has `SpotMtbData` (`trails[].gpxPoints`, camelCase, richer).
Define one neutral input type in `app/map/miniMap.ts` and have each caller adapt
to it:

```ts
export interface MiniMapPolyline {
  id: string
  kind: 'trail' | 'tour'
  name: string
  difficulty: string | null          // ImbaColor | null
  points: [number, number, number][] // [lat, lng, alt]
}
export interface MiniMapMarker {
  lat: number; lng: number
  kind: 'spot' | 'parking'
  spotType?: string                  // for markerIconOptions when kind === 'spot'
  approved?: boolean
  name?: string
  popupHtml?: string
}
export interface MiniMapInput {
  center: [number, number]
  zoom: number
  polylines: MiniMapPolyline[]
  markers: MiniMapMarker[]
}
export interface MiniMapOptions {
  interactive: boolean
  // Called when a polyline is clicked/tapped. Inline map → selectItem();
  // embed page → open the trail page in a new tab.
  onPolylineActivate?: (p: MiniMapPolyline) => void
  // Optional extra content for the hover/touch tooltip's action row.
  tooltipActionHtml?: (p: MiniMapPolyline) => string | null
  // Wire clicks on `.ttr-open` inside the tooltip (embed page uses this).
  onTooltipAction?: (p: MiniMapPolyline) => void
  showGpxAtZoom?: boolean             // default: use shouldShowGpx()
}
```

### API

```ts
export interface MiniMapHandle {
  flyTo(lat: number, lng: number, zoom?: number): void
  setData(input: MiniMapInput): void   // re-render polylines/markers without re-init
  destroy(): void
}
export async function createMiniMap(
  el: HTMLElement,
  input: MiniMapInput,
  options: MiniMapOptions,
): Promise<MiniMapHandle>
```

### What moves in from `embed/[token].vue` (verbatim behaviour)

- `L.map(el, { zoomControl: interactive, dragging: interactive, …, gestureHandling: interactive })`,
  `setView`, `setMaxZoom(19)`.
- OSM `L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', …)`.
- Tour polylines first (`#555`, weight 5, opacity 0.6, `dashArray: '8, 6'`),
  then trail polylines (`DIFF_COLOR[difficulty] ?? '#888'`, weight 6, opacity
  0.85) — trail hit-areas end up on top.
- The invisible weight-20 hit polyline + hover/mousemove/mouseout/touchstart
  tooltip wiring, `createTooltipEl`, `positionTooltip`, `computeTrailStats`,
  `trailTooltipHtml`, `placeholderDesc`, the 800ms/3000ms hide timers.
- `shouldShowGpx(hasGpx, zoom)` gate → markers vs polylines.
- Markers via `markerIconOptions` / `parkingIconOptions` + `L.divIcon`.
- The `trailradar:flyTo` handling becomes `handle.flyTo()` — the `message`
  listener stays in `embed/[token].vue` only (see Part 3), not in `miniMap.ts`.

Keep importing the already-shared helpers (`app/map/trailTooltip.ts`,
`app/map/markerIcon.ts`, `app/map/gpxZoomThreshold.ts`) — do not duplicate them.

### Unit tests

`app/map/miniMap.test.ts` — the pure parts only (Leaflet is browser-bound):
input-adapter helpers if any live here, the tour-before-trail ordering decision,
the `shouldShowGpx` branch selection. Full Leaflet rendering is covered by the
component + E2E tests.

---

## Part 2 — `app/components/trail_detail/SpotDetailMiniMap.vue`

New component, sibling of the other `SpotDetail*` components.

- Props: `spot: Trail` (for center + spot marker), `data: SpotMtbData | null`,
  `parking: SpotParkingLot[]`, `focus: { lat; lng; zoom } | null`.
- Client-only map init in `onMounted` (guarded — never during SSR/prerender).
  Render a plain `<div ref>` placeholder server-side; the section keeps its
  height so layout doesn't jump (reuse `.trail-map` / `.explore-map` CSS from
  `[slug].vue`, moved or shared).
- Builds `MiniMapInput` from props:
  - `center` = `[spot.latitude, spot.longitude]`, `zoom` = 11
  - polylines from `data.trails` / `data.tours` (`gpxPoints` → `points`)
  - markers: the spot itself + one per parking lot
- `createMiniMap(el, input, { interactive: true, onPolylineActivate: p =>
  spotPanelStore.selectItem(p.id, p.kind) })` — **wire the store via the
  component, not by importing the store into `app/map/`**.
- `watch(() => props.data / props.parking, → handle.setData(...))`.
- `watch(() => props.focus, focus => handle.flyTo(focus.lat, focus.lng, focus.zoom ?? 14))`;
  when `focus` goes null, fly back to the spot at zoom 11.
- `onUnmounted` (registered synchronously in setup, per the pattern the embed
  page uses — `AbortController` for listeners) → `handle.destroy()`.
- `useBackNavigation` etc. not relevant.

### Component test

`app/components/trail_detail/SpotDetailMiniMap.test.ts` — mock
`app/map/miniMap.ts` (`vi.mock`), assert:
- it calls `createMiniMap` once on mount with `interactive: true` and the
  correct `center`/polyline count derived from props
- a `focus` prop change calls `handle.flyTo` with those coords
- `focus` → null flies back to the spot at zoom 11
- `handle.destroy()` on unmount
- nothing runs during SSR (`import.meta.server` guard)

---

## Part 3 — rewire `app/pages/trails/[slug].vue`

**Trail branch** (`v-else-if="trail && trailForStore"`): replace the
`<iframe ref="mapIframeEl" :src="embedSrc" class="trail-map">` with:

```vue
<SpotDetailMiniMap
  :spot="trailForStore"
  :data="spotPanelStore.data"
  :parking="spotPanelStore.parkingLots"
  :focus="selectedItemFocus"
/>
```

Delete: `embedSrc` computed, `mapIframeEl` ref, `flyMapTo`, the
`watch(selectedItemFocus, …)` that called `flyMapTo`, `onParkingFlyTo`'s
`flyMapTo` call (parking selection can reuse `selectedItemFocus` or a small
local `focus` ref — see below), `FLY_TO_TRAIL_ZOOM` if now unused elsewhere,
`EMBED_TOKEN`/`EMBED_BASE` **iff** the region branch no longer needs them (it
does — keep them, see below).

`selectedItemFocus` stays (it already derives `{lat,lng}` from
`spotPanelStore.selectedItem*`). Extend it to also cover a selected parking lot,
or add a sibling `parkingFocus` ref set by `onParkingFlyTo(lat,lng)` and feed
whichever is active into `:focus`. Keep the existing midpoint-of-start-and-end
logic and `zoom: 14`.

**Region branch:** unchanged except it keeps `regionEmbedSrc` + the
`EMBED_BASE = import.meta.dev ? '' : 'https://trailradar.org'` gate from Part 0.
The region iframe has no `ref`/`postMessage` today, so nothing else to do.

**`refreshTrail` / client-side nav between spots:** the `watch(() =>
trailForStore.value?.id, …)` already re-calls `loadLiveSpotData` →
`spotPanelStore.load`. The mini-map's `watch` on `props.data` picks up the new
GPX automatically. Verify no stale-spot flash.

---

## Part 4 — refactor `app/pages/embed/[token].vue` onto `miniMap.ts`

- Adapt `EmbedTrail[]` → `MiniMapInput` (`gpx_trails`/`gpx_tours` →
  `polylines`, `parking` → `markers`, plus spot markers when
  `!shouldShowGpx`).
- `createMiniMap(el, input, { interactive, onPolylineActivate: p =>
  window.open(\`https://trailradar.org/trails/\${p.id}\`, '_blank', 'noopener'),
  tooltipActionHtml: … 'Spot öffnen' button, onTooltipAction: same open })`.
  Note: in the embed page `p.id` is the *spot* id (embed groups by spot), keep
  that mapping.
- Keep in `[token].vue`: the `/_embed/` fetch + error overlay, `parseEmbedQuery`
  / `getRequestedSearch`, the `message` listener (now → `handle.flyTo`), the
  `AbortController` teardown, the `event.origin` allowlist from Part 0.
- Result: `[token].vue` loses ~120 lines of Leaflet code.

---

## Part 5 — tests & invariants

### Update `app/architecture.test.ts`

- The "Embed page (self-contained)" block: `embed page uses shared
  markerIconOptions` — now satisfied transitively via `miniMap.ts`; change the
  assertion to allow the import to come through `~/map/miniMap` (or assert
  `miniMap` is imported instead).
- Add a rule: `app/map/miniMap.ts` may own Leaflet (`L`) but must not import
  `stores/` / `composables/`. Add it alongside the existing
  `trailTooltip.ts` "no leaflet at module level" style checks — `miniMap.ts`
  *does* import leaflet, but only dynamically inside a function; assert
  `import('leaflet')` (dynamic) and no top-level `from 'leaflet'`.
- If there's an assertion that Leaflet lives *only* in `useTrailMap`, widen it
  to `useTrailMap` + `app/map/miniMap.ts` (the embed page no longer inits
  Leaflet itself).

### `app/pages/trails/embed-iframe-src.test.ts`

Replace. The trailing-slash concern is moot for the spot map (no iframe). New
file `app/pages/trails/embed-base.test.ts` (or fold into a page test):
- `EMBED_BASE` is gated on `import.meta.dev`
- the region iframe src still carries the trailing slash (`/embed/${TOKEN}/?`)
- the spot branch renders `<SpotDetailMiniMap`, not an `<iframe`

### E2E — rewrite the 4 specs that drove the iframe

| Spec | Change |
|---|---|
| `tests/spot-panel-tours-trails.spec.ts:127` "flies the embedded map … without reloading the iframe" | No iframe / `contentFrame` / `postMessage`. Assert instead: clicking `#trails .spot-item[data-id="gt1"]` results in the mini-map container being present and the selected row active; if a `flyTo` is observable (e.g. a `data-*` hook or a spy), assert the midpoint `47.713, 11.763`. Drop the "src unchanged" assertion. |
| `tests/spot-panel-parking.spec.ts:34` "clicking a parking lot flies the embedded map" | Same shape — no iframe, assert row-active + (if observable) fly target `47.709, 11.758`. |
| `tests/trail-open.spec.ts:113` "/trails/[id] embeds a map centered on the trail's own coordinates" | Assert the `.trail-map` / mini-map container is visible on the trail page; the "not the embed-query default" framing no longer applies (no embed query). Keep a check that the map renders for a spot far from the old `DEFAULT_LAT/LNG`. |
| `tests/trail-open.spec.ts:136` + `:157` (region) | **Unchanged** — region still uses the iframe. Keep `iframe.region-map` assertions. |
| `tests/trails-detail-page.spec.ts:14` / `:149` | `:14` "renders the embedded map" → assert the mini-map container instead of `iframe.trail-map`. `:149` "embeds an interactive map … `src` contains `interactive=1`" → replace with an assertion that the mini-map is interactive (e.g. Leaflet drag handler present / zoom control rendered), since there's no `src` anymore. |

Consider exposing a tiny test hook on `SpotDetailMiniMap` (e.g.
`data-testid="spot-minimap"` + `data-fly="lat,lng,zoom"` updated on each
`flyTo`) so E2E can assert fly targets without reaching into Leaflet internals.
Document it in the component.

### Keep green

`npm test`, `npm run lint:arch`, `npm run test:e2e`, and
`npm run verify:static-build` (this one exercises a real `nuxt generate` served
as static files — confirm a trail page with the inline map still renders; add an
assertion for the map container if cheap).

---

## Part 6 — docs

- `CLAUDE.md`:
  - "Decision 9: double-Leaflet-bundle cost accepted" → note it's reversed for
    the spot page (inline `SpotDetailMiniMap`); region pages still iframe.
  - Key-files table: add `app/map/miniMap.ts` and
    `app/components/trail_detail/SpotDetailMiniMap.vue`.
  - The `useTrailMap` "only place Leaflet L exists" line → "…and
    `app/map/miniMap.ts` (the read-only mini-map renderer for the spot-detail
    page and the third-party embed page)".
- Add a short "Embedded maps" subsection under Features explaining: spot pages =
  inline component (offline-capable via the shared REST cache); region pages +
  third-party sites = `/embed/[token]` iframe + `/_embed` worker.

---

## Risks / watch-outs

- **`leaflet-gesture-handling` in the main bundle.** Today it's only in the
  embed route chunk. Inlining pulls it into the `[slug].vue` chunk. Acceptable
  (it's tiny), but dynamic-import it inside `miniMap.ts` alongside Leaflet so it
  stays out of the entry bundle.
- **Two Leaflet map instances** if the user navigates `/map` → spot page via
  client nav: they're independent (`SpotDetailMiniMap` inits its own `L.map`,
  does not touch `useTrailMap`). Confirm no global Leaflet singleton assumptions
  (the embed page already proves two instances coexist).
- **SSR/prerender:** the mini-map must render a stable placeholder server-side
  and only init Leaflet in `onMounted`. No hydration mismatch (the `<div>` is
  identical; Leaflet mutates it post-mount).
- **`spotPanelStore.data` timing:** it's `null` until `loadSpotData` resolves
  post-mount. Mini-map should init with just the spot marker and add polylines
  when `data` arrives (`setData`). Don't block map init on GPX.
- **Elevation-profile / tour-segment styling** on the main map (`useTrailMap`'s
  `watch`es on `useSpotPanelStore`) is a *different* surface — do not touch it.
- Region iframe still needs the `/_embed` worker online; that's fine per scope.

---

## Suggested commit sequence (feature branch)

1. Part 0 interim fix (`EMBED_BASE` gate + postMessage origin + `event.origin`
   allowlist) — shippable on its own.
2. `app/map/miniMap.ts` + unit test.
3. Refactor `embed/[token].vue` onto it; keep `embed.spec.ts` green.
4. `SpotDetailMiniMap.vue` + component test.
5. Rewire `[slug].vue` trail branch; delete iframe plumbing.
6. Rewrite the 4 E2E specs; update `architecture.test.ts`,
   `embed-iframe-src.test.ts`.
7. Docs (`CLAUDE.md`, this file → Status: done).
