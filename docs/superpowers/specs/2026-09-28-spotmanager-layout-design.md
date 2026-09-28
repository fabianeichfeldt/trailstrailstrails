# SpotManager layout: bigger desktop sidebar, resizable mobile sheet

## Problem

`SpotManagerApp.vue`'s sidebar (`.sm-sidebar`) is a fixed `360px` panel on desktop and, on mobile (`@media max-width: 700px`), collapses into a bottom sheet capped at `max-height: 55vh`, floating over the map. On desktop it's cramped for a panel that hosts trail/tour lists, multi-field edit forms, the spot-details editor, and embed-token management. On mobile it's worse: 55vh is often too little for these same forms, and the height is fixed — the user has no way to see more of the panel (or more of the map) without a code change.

## Scope

Two independent, additive changes to `app/components/spotmanager/SpotManagerApp.vue`. No template restructuring, no new views, no change to the segment editor or parking editor's internal behavior — they keep working exactly as they do today, just inside a differently-sized container.

Explicitly out of scope (considered and rejected during brainstorming): a fullscreen mobile menu with the map opening on demand via a button or tab bar. That would require special-casing the segment editor and parking editor, which inherently need the map and a form visible at once — not worth the added complexity right now. A resizable panel sidesteps that problem entirely.

## 1. Desktop — wider sidebar

Change in the scoped `<style>` block of `SpotManagerApp.vue`:

```css
.sm-sidebar {
  width: 480px; /* was 360px */
  ...
}
```

No other layout changes. Existing grids (`sd-status-grid-3`, `sd-access-grid-3`), forms, and lists keep their current single-column structure — they simply get more padding/breathing room at the new width. This is a pure CSS value change with no logic implications.

## 2. Mobile — drag-resizable bottom sheet

Replace the fixed `max-height: 55vh` rule with a user-draggable height.

**Structure:** add a grip handle bar as the first child of `.sm-sidebar` when mobile — a full-width, ~28px-tall strip with a centered pill/grip icon (visually consistent with the existing `sm-drag-handle` used for list reordering). This handle is the drag target; the rest of `.sm-sidebar`'s existing content (selector, list, editors, segment editor, parking editor, embed views) is unchanged beneath it.

**Interaction:** pointer events (`pointerdown` / `pointermove` / `pointerup`), following the same pattern already used in `ScrubberCanvas.ts` for the elevation scrubber. Dragging the handle adjusts the sheet's height in real time:

- **Minimum height: 18vh** — enough to see the current view's title and first item, but never fully collapsible to 0. The sheet can never be dragged away entirely.
- **Maximum height: 92vh** — near-fullscreen, leaving a sliver of map and the top bar visible.
- **Default height: 55vh** — unchanged from today. This is a pure enhancement; nothing about the starting experience regresses.
- **Free drag, no snap points.** Simplest to implement and reason about; revisit only if user feedback asks for snap-to-half/full behavior.

**Persistence:** the last dragged height is written to `localStorage` (key: `sm-sheet-height-vh`) and restored on mount, so a user who prefers a taller sheet doesn't have to redrag it every visit. If no stored value exists (or it's invalid/out of `[18, 92]` bounds), fall back to the 55vh default.

**Pure logic extraction:** the height computation — given a starting height, a pointer-drag delta, and the viewport height, clamp to `[18vh, 92vh]` — is extracted into a small pure function in `app/spot_manager/` (sibling to `GpxProcessor.ts` / `coords.ts`, e.g. `sheetResize.ts`), so it can be unit tested independent of DOM/pointer wiring. The `localStorage` read/write for the remembered height (and the hint-dismissed flag below) are also small testable helper functions in the same module.

## 3. "Desktop preferred" hint

A small, dismissible, non-blocking banner at the top of `.sm-sidebar`'s content (below the grip handle), mobile-only:

> 💻 SpotManager funktioniert am besten auf einem größeren Bildschirm.

With a close (×) button. Dismissal is written to `localStorage` (key: `sm-desktop-hint-dismissed`) and checked on mount — once dismissed, it never reappears in that browser. This is advisory only; it never blocks or gates any functionality.

## Testing

Per this project's testing rules (vitest-first; Playwright only for behavior that genuinely needs a real browser):

- **Vitest** (`app/spot_manager/sheetResize.test.ts`):
  - The clamp function returns `18` (vh) when a drag would push below the minimum, `92` when it would push above the maximum, and the expected mid-range value otherwise.
  - The `localStorage` helpers for remembered sheet height: valid stored value is restored; missing, corrupt, or out-of-bounds values fall back to the 55vh default.
  - The hint-dismissed helper: unset → hint should show; set → hint should stay hidden. (`localStorage` mocked, no real DOM.)
- **Playwright** (extend an existing mobile-viewport spec, or add a small new one):
  - At a phone viewport, drag the sheet handle and assert the sheet's rendered height actually changes, and that the new height survives a page reload (real pointer-drag + real layout measurement — the case vitest can't cover).
  - Assert the desktop-preferred hint appears on first mobile load, and stays gone after clicking × and reloading.
- No new test for the desktop width bump — it's a static CSS value with no branching logic, not worth a Playwright viewport assertion.

## Non-goals / explicitly deferred

- No fullscreen mobile menu, no bottom tab bar, no map-on-demand button. (Discussed and rejected — see Scope.)
- No two-column reflow of edit forms on the wider desktop sidebar — forms keep their current single-column layout.
- No snap points for the mobile sheet drag.
