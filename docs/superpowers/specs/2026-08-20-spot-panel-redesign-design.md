# Spot Panel Redesign — Design Spec

**Date:** 2026-08-20
**Status:** Superseded by `2026-08-25-spot-detail-real-pages-design.md`. That spec's Decision 7: Phase 1 (touch targets/photo/status banner/header) and Phase 2 (list row density) were folded into the spot-detail-real-pages rework and applied directly to the relocated section components — Phase 3 (sheet snap points + elevation drill-in) and Phase 4 (Capacitor safe-area CSS for the sheet) are superseded outright, since `SpotPanel.vue` (the bottom-sheet this entire spec targets) and `dragHandle.ts` were deleted as part of that rework rather than adapted. Kept here for historical context only.

## Purpose

Follow-up to a mobile UX field audit of `/map`'s SpotPanel (real device viewport, live data, `Bierstadttrails Kulmbach`). User feedback said the panel feels "too small / too packed." The audit found: sub-44px touch targets throughout, a hero photo that gets pillarboxed by a fixed 4:3 `object-fit: contain` box and loads last behind four rows of chrome, list rows carrying up to five stacked type styles, an elevation chart that steals space from the list beside it instead of the sheet growing, and a hard `72vh` ceiling on the sheet regardless of content or drag. This spec turns those findings into four independently shippable phases.

## Scope decisions

- **One spec, phased.** Phases are designed together so later ones (sheet mechanics) don't contradict earlier ones (photo box sizing), but each phase is its own PR-sized, independently testable change.
- **Photo treatment:** a taller cover-crop box within the panel's existing position (not a full-bleed reorder above the title) — see Phase 1.
- **Sheet snap points are in scope** (Phase 3) — they're also what unblocks the list-density and elevation-crowding findings, which are hard to fix well inside a fixed-height shell.
- **Mobile-first**: all four phases target the mobile bottom-sheet layout (`spot_panel.css` base rules, below the `768px` breakpoint). Desktop's right-side panel (`spot_panel.css:664+`) inherits Phase 1/2's shared CSS automatically but keeps its own horizontal freeform resize — see each phase for what's explicitly excluded on desktop.
- **Out of scope:** full-bleed hero photo, desktop-specific resize/snap behavior, haptic feedback on snap, tab-bar horizontal scrolling. See "Out of scope" at the end for why.

---

## Phase 1 — Quick wins: touch targets, photo, status banner, header

Lowest risk, no interaction-model changes, ships first.

### Touch targets

Every icon-only control grows its hit area to 44×44 minimum without growing the icon itself (padding, not icon `font-size`):

- `.spot-action-btn` (like/share), `.spot-panel-close` — `spot_panel.css:127–153`.
- `.spot-item-dl` (GPX download, currently 28×28) — `spot_panel.css:280–300`.
- `.spot-elevation-download` (currently 32×32) / `.spot-elevation-close` — `spot_panel.css:405–443`.

### Photo (`photo_caroussel.css`, `detailsPopup.ts`)

- `.photo-container`: `aspect-ratio: 4/3` → `4/5` (portrait-leaning — most rider-shot trail photos are portrait) and `object-fit: contain` → `cover` on `.photo-carousel img`. Portrait shots fill edge-to-edge; landscape shots crop top/bottom instead of pillarboxing.
- Remove `.photo-wrap::before`'s blurred pillarbox fill (`photo_caroussel.css:50–67`) — it existed only to disguise `contain`'s letterboxing; `cover` leaves no gap to fill, so it becomes dead paint once this ships.
- `.photo-meta` caption: `font-size: 0.55em` → fixed `11px`; `.photo-date`'s `0.9em` (relative to that) → fixed `10px`. Currently computes to roughly 7–8px and is effectively unreadable — the only credit a contributing photographer gets.
- `.no-photos` empty state: same full-width treatment as the new photo box, icon bumped from `1.6em` to a fixed ~28px, and `.photo-upload-btn` gets real button styling (filled background, not link-weight text) — it's already a `<button>`, it just needs to look like one.

### Status banner (`spot_panel.css:464–553`)

Pure type-scale bump, no structural change — this pattern (color + icon + text) was flagged as already working:

- `.ssb-dot`: `10px` → `13px`.
- `.ssb-labels strong`: `13px` → `16px`.
- `.ssb-hint`: `11px` → `13px`.

### Header (`spot_panel.css:44–74`, `SpotPanelHeader.vue`)

- Title gets its own row at `18px` (from `15px`).
- `.spot-panel-meta-row` (org link + like/share) becomes a clearly separated second row instead of sharing a cramped ~20px strip with the title.

---

## Phase 2 — List density (Tours / Trails / Parking rows)

Targets `SpotPanelTrailsTab.vue` and `SpotPanelToursTab.vue` (`.spot-item-stats`, currently 3 stacked lines: distance, elevation gain/loss, direction label — confirmed at `SpotPanelTrailsTab.vue:33–37`) plus `spot_panel.css:280–334`.

- Merge distance + elevation onto one line: `📍 0.7 km · ↑2m ↓118m` instead of two separate lines.
- `.direction-tag` moves from a third stacked line in `.spot-item-stats` to an icon-only glyph next to `.spot-item-sub` (the difficulty label) on the left side — e.g. `↓` for downhill-only, `↕` for both directions. Needs a new `DIR_ICON` map alongside the existing `DIR_LABEL` in `src/map/spot_panel/spotPanelHtml.ts`, keeping `DIR_LABEL` for the `title`/`aria-label`.
- Net effect: right column goes from 3 lines to 1, row height can drop from ~65px to ~48px **without cutting any information** — direction becomes an icon instead of a text label, distance and elevation share a line.
- `.spot-item-info strong` (name): `13px` → `14px`, using the vertical space freed by the shorter row.

---

## Phase 3 — Sheet mechanics: snap points + elevation drill-in

Mobile only (`isDesktopViewport() === false`, `src/map/spot_panel/dragHandle.ts:5`). Desktop's horizontal resize (`spot_panel.css:664+`, `doResize`'s `isHorizontal` branch) is unchanged.

### Snap points

`dragHandle.ts`'s `stopResize()` (`:53–58`) currently just stops — the sheet stays wherever the drag ended. Replace with a snap to the nearest of three targets:

- `peek`: `15vh` — handle, title, and status banner only; enough to confirm the sheet is open while still seeing most of the map.
- `half`: `56vh` — today's default, unchanged.
- `full`: `92vh` — full working room for content-heavy tabs.

New pure function `nearestSnapPoint(currentVh: number): 'peek' | 'half' | 'full'` (new file `src/map/spot_panel/snapPoints.ts`, or appended to `dragHandle.ts`) picks whichever of `[15, 56, 92]` is closest — kept pure and DOM-free so it's unit-testable. On `touchend`/`mouseup`, `dragHandle.ts` computes the current height as a vh fraction, calls `nearestSnapPoint`, and animates `panel.style.height` to the target (`transition: height .25s cubic-bezier(...)`, mirroring the existing `transform` easing already used for open/close).

`spot_panel.css`: `.spot-panel`'s `min-height`/`max-height` become `15vh` / `92vh` (from today's `320px` / `72vh`) as safety bounds — height itself is now snap-driven, not freely dragged.

`openSpot()` / `openParkingLot()` (`stores/spotPanel.ts:180–193`) continue to open at `half`, unchanged.

### Elevation drill-in

Today, `.spot-elevation-panel` (`spot_panel.css:380–458`) is a flex sibling of `.spot-panel-body` inside the same fixed shell — opening it shrinks the list instead of growing the sheet. Change:

- `.spot-elevation-panel` becomes `position: absolute; inset: 0` over `.spot-panel-body`'s container, replacing the visible tab content rather than squeezing it. The existing `elevationVisible` computed (`SpotPanel.vue:44`, gated on `store.selectedItemId`/`selectedItemKind`) needs no change — only the CSS layout mode.
- When `store.selectSpotItem()` sets `selectedItemId`/`selectedItemKind` (`stores/spotPanel.ts:124–125`) on mobile, also trigger a snap-to-`full` through the same mechanism `dragHandle.ts` exposes for the drag gesture — picking a tour to inspect its profile gets the whole sheet, not a shrunk list underneath a chart.
- `store.clearSelection()` — already wired to the elevation panel's `×` (`SpotPanelElevation.vue:12`) — returns to the list. Sheet height stays wherever the rider left it; no forced snap-back, since closing a drill-in view shouldn't override a resize the rider made on purpose.

The elevation-as-overlay layout change applies on desktop too (for one consistent layout mode), but the auto-snap-to-`full` trigger is mobile-only — desktop's panel is already close to full height (`top: 12px; bottom: 12px`), so the crowding problem barely exists there.

---

## Phase 4 — Capacitor readiness (safe-area, touch-target confirmation)

Progressive enhancement, CSS-only, ships ahead of Capacitor being wired into the root build — `android/` and `ios/` are already scaffolded in this repo but neither is in `package.json` nor has a `capacitor.config.*` at the project root yet.

- `.spot-panel` (mobile): add `padding-bottom: max(12px, env(safe-area-inset-bottom))` to the shell's own bottom spacing (currently none) so the sheet's lowest interactive row clears a home indicator once wrapped natively. `env()` no-ops harmlessly on the web today.
- `.spot-panel-handle` (mobile): respect `env(safe-area-inset-top)` for the Phase 3 `full` (`92vh`) target so it doesn't clip under a notch/status bar.
- Manual QA only (not part of the automated build): confirm Phase 1's touch targets read as 44pt/48dp inside the already-scaffolded `ios/`/`android/` shells via `npx cap open ios` / `android`.
- **Explicitly excluded:** haptic feedback on snap. Needs `@capacitor/haptics` added to the project and the native shells wired into an actual build pipeline — neither exists yet. Follow-up once Capacitor is a real build target, not a CSS-phase concern.

---

## Testing

**Unit tests (vitest):**
- `src/map/spot_panel/snapPoints.test.ts` (new): `nearestSnapPoint()` — boundary cases at the midpoints between `15/56/92`.
- `src/stores/spotPanel.test.ts`: extend for the mobile "selecting an item requests a snap-to-full" behavior. Keep the store's contribution to this pure/testable (e.g. a `snapRequested` ref the component watches) rather than having the store reach into the DOM.
- `src/map/spot_panel/spotPanelHtml.test.ts`: extend for the new `DIR_ICON` map (Phase 2) — icon output per direction value.
- Existing `SpotPanelHeader.test.ts`, `SpotPanelTabs.test.ts`, `SpotPanelTrailsTab`/`ToursTab` coverage (implicit via existing component tests) gets updated assertions where markup shape changes, not new files.

**Playwright E2E** (mandatory — this touches map interaction, per project convention):
- `tests/spot-panel-header-tabs.spec.ts`: extend to assert action buttons stay clickable at their new hit size, not just visually redrawn.
- `tests/spot-panel-tours-trails.spec.ts`: extend — selecting a tour at mobile viewport width asserts the sheet reaches its `full` height and the elevation view fully covers the list (drill-in), not a shrunk list beside a chart.
- New case: drag the handle partway and release; assert the sheet lands on the nearest snap point, not wherever the drag ended.

**Accepted gaps:**
- Pixel-level 44px touch-target verification isn't something vitest/Playwright can check against real platform pt/dp units — verified via `getBoundingClientRect().width/height >= 44` assertions in Playwright, not a dedicated accessibility-audit tool.
- Phase 4's native safe-area behavior can't be exercised in the web-only CI Playwright run — verified manually in the scaffolded iOS/Android shells, the same "not automated, verified manually" treatment this project already gives Postgres RLS policies in other specs.

## Architecture impact

None. All changes stay within `src/components/map/`, `src/map/spot_panel/`, `src/stores/spotPanel.ts`, and their CSS — no new cross-layer imports. `dragHandle.ts` gains one new pure exported function but keeps its existing shape (receives the panel element, has no store/component knowledge).

## Out of scope

- **Full-bleed hero photo** — rejected in favor of the taller cover-crop box within the panel's existing order (title/tabs/status banner still precede the photo); revisit only if Phase 1's cover-crop still under-delivers on "photos as a highlight."
- **Desktop-specific layout changes** beyond what Phase 1/2's shared CSS naturally carries over — desktop's own horizontal resize is untouched, and it isn't where the "too small / packed" feedback originated.
- **Haptic feedback on snap points** — needs Capacitor actually wired into the build; see Phase 4.
- **Tab bar horizontal scroll / 5th-tab handling** — flagged as low-urgency in the audit (§04), no near-term new tab planned.
