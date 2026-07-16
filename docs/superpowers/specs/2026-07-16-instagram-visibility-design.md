# Instagram Link Visibility — Design Spec

**Date:** 2026-07-16
**Status:** Approved

---

## Summary

Add a brand-colored, icon-only Instagram link to `AppHeader.vue` (visible on non-map pages) and to the map view's burger menu (`Drawer.vue`), so the channel is discoverable without scrolling to the footer. The existing plain-text footer link stays unchanged.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Surfaces | Header + Drawer | Covers both the general site (header, sticky on every non-map page) and the map view, which has its own layout without `AppHeader` |
| Footer | Unchanged | Already has a working link; no need to touch it |
| Visual style | Icon-only, Instagram brand gradient | Matches the existing `fab fa-instagram` icon used in `detailsPopup.ts`; a filled gradient circle stands out against both the dark header and the white drawer without needing a text label |
| Header placement | `header-right`, between "Zur Karte →" and login/avatar | Keeps existing reading order (brand → primary nav → social → account) |
| Drawer placement | Own row directly below `drawer-header`, above the filter box | Gives it dedicated visual space so it reads as a deliberate menu item rather than a cramped icon crammed next to the close button |
| Touch target | 44×44px effective tap area in both places | Mobile-first requirement per `CLAUDE.md` |

---

## Changed files

| File | Change |
|---|---|
| `src/components/AppHeader.vue` | Add `<a class="header-instagram">` with `fab fa-instagram` icon in `header-right`, between the map link and the `ClientOnly` auth block. New scoped CSS: circular gradient button, ~36px visual size, 44px tap target, hover brightness/scale. |
| `src/components/map/Drawer.vue` | Add a `drawer-social` row (centered gradient circle button, 44px) directly after `drawer-header`, before `filter-box`. Same icon/link, same `aria-label`. |

No changes to stores, composables, or communication layers — this is static markup + CSS, using a hardcoded external URL exactly as the footer already does.

---

## Markup

```html
<!-- AppHeader.vue, inside header-right -->
<a class="header-instagram" href="https://www.instagram.com/trailradar.germany"
   target="_blank" rel="noopener noreferrer" aria-label="Trailradar auf Instagram">
  <i class="fab fa-instagram"></i>
</a>
```

```html
<!-- Drawer.vue, between drawer-header and filter-box -->
<div class="drawer-social">
  <a class="drawer-instagram" href="https://www.instagram.com/trailradar.germany"
     target="_blank" rel="noopener noreferrer" aria-label="Trailradar auf Instagram">
    <i class="fab fa-instagram"></i>
  </a>
</div>
```

Both use the same gradient: `linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)`, white icon glyph.

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
