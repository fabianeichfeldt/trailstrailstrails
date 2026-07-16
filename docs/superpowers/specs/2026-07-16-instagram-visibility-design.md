# Instagram Link Visibility — Design Spec

**Date:** 2026-07-16
**Status:** Approved

---

## Summary

Add a small, icon-only Instagram link to `AppHeader.vue` (visible on non-map pages) and to the map view's burger menu (`Drawer.vue`), so the channel is discoverable without scrolling to the footer. The existing plain-text footer link stays unchanged.

**Revision (same day):** the initial implementation used a large filled Instagram-gradient circle badge (44px), placed in the header's right-hand action cluster and in its own row at the top of the drawer. User feedback: too big and visually loud for a nav bar. Revised to a small (32px) plain icon, brand-pink glyph with no background fill, placed to the left (next to the logo) in the header and at the bottom of the drawer (next to the "Zur Startseite" link) rather than the top.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Surfaces | Header + Drawer | Covers both the general site (header, sticky on every non-map page) and the map view, which has its own layout without `AppHeader` |
| Footer | Unchanged | Already has a working link; no need to touch it |
| Visual style | Icon-only, small, single brand-pink glyph (no background fill) | Matches the existing `fab fa-instagram` icon used in `detailsPopup.ts`; a full gradient badge read as too heavy/loud next to the muted nav controls (user feedback) |
| Header placement | New `header-left` wrapper around the logo/brand link and the icon, so it sits immediately to the right of the logo | Keeps it visually anchored to the brand rather than competing with the primary nav/account controls on the right |
| Drawer placement | Bottom of the drawer, directly below the "← Zur Startseite" link | A quiet, secondary spot rather than the first thing seen on opening the menu (user feedback: too prominent at the top) |
| Touch target | 32×32px visual size (was 44px) | Reduced per user feedback — this is a secondary, decorative link, not a primary action |

---

## Changed files

| File | Change |
|---|---|
| `src/components/AppHeader.vue` | Wrap the existing `header-brand` `NuxtLink` in a new `header-left` flex container, and add `<a class="header-instagram">` (32px, plain `fab fa-instagram` icon in brand pink, no background) as its sibling inside `header-left`. |
| `src/components/map/Drawer.vue` | Add a `drawer-social` row (same 32px plain icon) directly after the "Zur Startseite" `home-link`, at the very bottom of the drawer. |

No changes to stores, composables, or communication layers — this is static markup + CSS, using a hardcoded external URL exactly as the footer already does.

---

## Markup

```html
<!-- AppHeader.vue, inside a new header-left wrapper, next to header-brand -->
<a class="header-instagram" href="https://www.instagram.com/trailradar.germany"
   target="_blank" rel="noopener noreferrer" aria-label="Trailradar auf Instagram">
  <i class="fab fa-instagram"></i>
</a>
```

```html
<!-- Drawer.vue, after home-link, at the bottom of the drawer -->
<div class="drawer-social">
  <a class="drawer-instagram" href="https://www.instagram.com/trailradar.germany"
     target="_blank" rel="noopener noreferrer" aria-label="Trailradar auf Instagram">
    <i class="fab fa-instagram"></i>
  </a>
</div>
```

Both: 32×32px, `color: #e1306c` (single Instagram pink), `opacity: 0.8` at rest → `1` on hover, no background fill.

---

## Tests

No existing test files cover `AppHeader.vue` or `Drawer.vue`. New component tests:

### `src/components/AppHeader.test.ts`
| Test | Assertion |
|---|---|
| Instagram link renders | `href="https://www.instagram.com/trailradar.germany"`, `target="_blank"`, `rel="noopener noreferrer"` present |

### `src/components/map/Drawer.test.ts`
| Test | Assertion |
|---|---|
| Instagram link renders | Same href/target/rel assertions, present regardless of `drawerOpen` state |

No Playwright coverage needed — static link markup isn't on the map/auth/add-spot critical path per `CLAUDE.md`'s E2E trigger list.

---

## Out of scope

- Footer styling changes (explicitly left as plain text).
- A dedicated "Follow us" CTA card/section elsewhere (e.g. homepage) — not requested.
- Any analytics/click tracking on the new links.
