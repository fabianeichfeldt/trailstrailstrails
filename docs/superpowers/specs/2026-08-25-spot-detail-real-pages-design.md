# Spot Detail Real Pages — Design Spec

**Date:** 2026-08-25
**Status:** Approved — ready for implementation planning.

## Purpose / problem statement

The SpotPanel bottom-sheet/side-panel (`app/components/map/SpotPanel.vue`, driven entirely by `stores/spotPanel.ts`'s `isOpen`/`openSpot()`/`close()`) has no URL of its own. It's pure client state layered over `/map`, so:

- No browser back/forward, no bookmarking, no native iOS swipe-back or predictable Android hardware-back behavior for "close this spot."
- Sharing a spot (`spotPanelShare.ts`'s `trailShareUrl()`) already points at `/trails/{id}` — but that page (`app/pages/trails/[slug].vue`) is a thin static marketing shell with none of the panel's features (no tabs, comments, likes, parking, GPX elevation). Every shared link today undersells the spot.
- A prior field-audit spec (`2026-08-20-spot-panel-redesign-design.md`, approved but not yet implemented) already documents the sheet itself feeling "too small / too packed" on mobile — this rework is a more fundamental architectural response to the same underlying pain.

Goal: replace the panel with a real, routed page per spot — `/trails/[slug]` evolved into the full experience — with genuine back/forward on web, iOS, and Android, presented more like a polished site (legallines.de was the visual reference point) than a modal overlay. The map itself doesn't need to stay live/interactive behind it — the page embeds the existing token-scoped read-only map widget for geographic context, the same way `/trails/[slug]` already does today.

## Decisions made (confirmed with the user this session)

1. **One URL per spot, evolved from the existing page.** `/trails/[slug]` becomes the full interactive experience rather than adding a separate route (e.g. `/spot/[slug]`) alongside it. Rationale: avoids maintaining two overlapping pages for the same content, and this page is already wired into the existing prerender/sitemap/share-link infrastructure.
2. **Marker click = full navigation.** Tapping a marker on `/map` does `router.push('/trails/[slug]')`, leaving the Leaflet map behind entirely — not an inline preview/popup first. Native back / browser back returns to `/map`.
3. **Page structure: long scroll, sectioned — not tabs.** Rejected keeping the current 4-tab (Info/Tours/Trails/Parking) structure in favor of one continuous page with labeled sections, closer to legallines.de and to `/trails/[slug]`'s own existing style.
4. **Sticky fast-access nav, pinned from the start.** A jump-link bar under the hero for quick access to sections, sticky (`position: sticky`) from page load rather than appearing only after scrolling past the hero — simplest to implement, no scroll-position tracking needed.
5. Section order settled: **Hero → embedded map → Beschreibung → Touren (elevation inline) → Trails → Parkplätze → Kommentare.**
6. **No deep-linking into tour/trail/parking selection for now.** Selecting an item within a section stays in-page state (no `?tour=id`/`#anchor` for the selection itself, as opposed to the section jump-links). YAGNI — revisit only if there's a real request for it later.
7. **Overlapping prior spec resolved:** `2026-08-20-spot-panel-redesign-design.md`'s Phase 1 (touch targets/photo/status banner) and Phase 2 (list row density) get **folded into this rework** — applied directly on the new page's relocated sections rather than fixed on the sheet first. Its Phase 3 (drag snap points) and Phase 4 (Capacitor safe-area CSS for the sheet) are **superseded** by this spec, since the sheet they target gets deleted — that spec's Status header should be updated to reflect this once this rework starts.
8. **Data-loading home: repurposed `stores/spotPanel.ts`.** Stays a Pinia store (matches `CLAUDE.md`'s "each store owns one domain" convention), driven by a `load(spotId)` called from the page's `setup()` instead of `openSpot()`/`close()`'s open/close state.
9. **Embed iframe performance accepted as-is.** Reuse `/embed/[token]` unchanged, including the double-Leaflet-bundle cost — already proven in production on this exact page; keeps this rework scoped to navigation/structure rather than opening a new map-rendering approach.
10. **"View on map" CTA flies to the spot.** Replaces today's `/map?trail=slug` (which reopened the panel via a query-param watcher) with navigating to `/map` and flying/centering the camera on the spot's marker — nothing opens on top, since the spot page is now the detail view.

## Current-state findings (grounding facts for resuming this work)

- **Clean retirement path.** `grep` for `SpotPanelInfoTab|SpotPanelToursTab|SpotPanelTrailsTab|SpotPanelParkingTab|SpotPanelElevation|useSpotPanelStore` across `app/` (excluding tests) hits only: the panel's own component family, `stores/spotPanel.ts`, `composables/useTrailMap.ts`, and `pages/map.vue`. SpotManager does not touch any of it — no admin-side coupling to worry about.
- **Why `/trails/[slug]` works today despite "no live Nitro server in prod."** `nuxt.config.ts`'s `nitro:config` hook fetches every trail/park/dirtpark at *build* time and explicitly pushes `/trails/${t.id}` into `nitroConfig.prerender.routes`; `crawlLinks: true` means the crawler follows the page's own `$fetch('/api/trail/${slug}')` call during that prerender pass and bakes the response into static JSON. This is the documented mechanism from `CLAUDE.md`'s "No live Nitro server" section, already working in production for this exact page.
- **The page's client-side refetch is currently a no-op in production.** `useAsyncData(..., { getCachedData: () => undefined })` forces a client refetch after hydration, but in prod that refetch hits the same static-baked `/api/trail/[id]` JSON — there is no live server to return anything fresher. The comment in the code ("keeps it consistent if the server-rendered result is stale") does not hold today. This needs fixing as part of the rework, not preserving as-is (see Data Fetching Strategy below).
- **Marker-click call sites.** Every `marker.on('click', ...)` in `useTrailMap.ts` (confirmed at roughly lines 273, 335, 469/495, 528, plus the `openTrailFn` used for query-param/search-driven opens at ~556) calls `spotPanelStore.openSpot(trail)` directly. All of these need to become `router.push` calls.
- **Native back button infrastructure already exists and mostly already does the right thing.** `app/plugins/capacitor.client.ts` registers one global `App.addListener('backButton', ...)` for the app's lifetime: it calls `runBackHandlers()` (the registry in `app/utils/nativeBack.ts`) first, then falls back to `window.history.back()`. `useTrailMap.ts` currently registers a page-scoped handler there to dismiss the spot panel before falling through to history. Once "open a spot" is real router navigation, that custom handler becomes redundant — `window.history.back()` already covers it — so it should be **deleted, not adapted**.
- **Elevation hover currently touches the live map.** `SpotPanelElevation.vue`'s `onHover`/`onHoverEnd` props are bridged through `MapView.vue`'s `ready` event → `map.vue` → `SpotPanel.vue` → here, ultimately driving a Leaflet hover marker in `useTrailMap.ts`. The new page has no live interactive map to target — only a same-origin but separate-document `/embed/[token]` iframe. This specific micro-interaction cannot carry over unmodified (see Known Behavior Changes).
- **Overlapping prior spec.** `docs/superpowers/specs/2026-08-20-spot-panel-redesign-design.md` ("Spot Panel Redesign — Design Spec," status "Approved, pending implementation," **not yet committed to git** as of this writing) phases in: Phase 1 touch-target/photo/status-banner fixes, Phase 2 list-row density fixes (Tours/Trails/Parking), Phase 3 sheet snap points + elevation drill-in, Phase 4 Capacitor safe-area CSS for the sheet. Resolved in Decision 7 above: Phases 1/2 fold into this rework, Phases 3/4 are superseded.

## Data fetching strategy

- SSG base content (name, description, rules, GPX tracks/tours list, photos, opening hours) stays prerendered via the existing crawler mechanism — no change needed, good for SEO.
- Live/dynamic bits (status hint, likes, comment thread, parking lots) fetch client-side directly against Supabase REST after mount, reusing the functions `stores/spotPanel.ts` already calls (`loadParking`, `loadComments`, `getTrailDetails` in `communication/trails.ts`) rather than going through the static-baked `/api/trail/[id]`. This is what makes the existing `getCachedData: () => undefined` comment actually true instead of a no-op.

## Component/architecture changes

- `SpotPanel.vue` and `app/map/spot_panel/dragHandle.ts` (drag/snap/bounce logic) get deleted entirely.
- Tab components (`SpotPanelToursTab`, `TrailsTab`, `ParkingTab`, `Elevation`, `Comments`) get **relocated as page sections, not rewritten** — same underlying logic, no longer tab-switched. Phase 1/2 touch-target/photo/density fixes from the old spec apply here directly.
- `SpotPanelInfoTab.vue` is the exception: it currently renders raw HTML via a legacy `renderTrailDetails()` string-templating function (`app/map/detail_popup/detailsPopup.ts`) with manual `bindPopupEvents()` DOM wiring, left over from the pre-Nuxt codebase. Converting this to a proper Vue component is part of this work rather than dragging the legacy pattern onto the new page.

## Embed map specifics

Reuse the existing hardcoded `EMBED_TOKEN` + `/embed/[token]?lat=&lng=&zoom=&parentHost=` iframe pattern unchanged — already proven in production on this exact page. Double-Leaflet-bundle cost accepted (Decision 9).

## Known behavior changes / tradeoffs

- **Elevation-hover-highlights-map-marker is dropped.** No live map exists on the new page to target; driving the embed iframe via `postMessage` would be new engineering scope not proposed here. The tour-segment SVG coloring (already distinct per segment) remains as the visual aid that stays.
- **"View on map" CTA changes** per Decision 10 above.

## Rollout / migration phases

1. Build the evolved `/trails/[slug]` page (all sections + live data fetching + Phase 1/2 touch-target/density fixes) while the SpotPanel keeps working as today — marker clicks still open the panel.
2. Convert `SpotPanelInfoTab`'s legacy raw-HTML rendering to a proper component, as part of (1).
3. Switch every marker-click handler in `useTrailMap.ts` from `spotPanelStore.openSpot(trail)` to `router.push(\`/trails/${trail.id}\`)`, and update the "View on map" CTA to fly-to-spot on `/map`.
4. Delete `SpotPanel.vue`, `dragHandle.ts`, the panel's back-handler registration, and the `isOpen`/`openSpot`/`close` surface of `stores/spotPanel.ts`.
5. Update `2026-08-20-spot-panel-redesign-design.md`'s Status header to note Phases 3/4 are superseded by this spec.

## Testing implications

- Existing `SpotPanel*.test.ts` unit tests get ported to test the relocated section components directly, not through the panel wrapper.
- Playwright specs asserting panel-open behavior (`tests/spot-panel-*.spec.ts`) need rewriting around real navigation + back-button assertions — a genuine new user-flow change per `CLAUDE.md`'s mandatory E2E-on-map-interaction rule.
- New coverage needed for: marker click → real navigation → back returns to `/map` with expected state; Android hardware back on the new page (manual-only verification, same precedent set in `2026-08-20`'s spec for its own native-only checks).
