# PWA Install Banner — Design Spec

**Date:** 2026-06-19  
**Status:** Approved

---

## Summary

A dismissable bottom-sheet banner that appears on the map page after 8 seconds, advertising and explaining the PWA install feature. Shows a native install prompt on Android/Chrome; shows manual instructions on iOS. Does not reappear for 14 days after dismissal.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Position | Bottom sheet, slides up | Most recognisable PWA prompt pattern on mobile; matches OS install sheet convention |
| Pages | Map page only | The map is the moment of peak value — seeing real trail markers is when "I want this on my phone" clicks |
| Trigger | 8-second dwell timer | Long enough to not interrupt, short enough to catch engaged users |
| iOS handling | Show with manual instructions | MTB audience is iPhone-heavy; two-step Share → Add flow is well understood |
| Visual style | Dark card (`#16181a`) | Matches app header/footer palette; green CTA (`#58c27d`) pops against dark background |
| Dismiss persistence | `localStorage`, 14 days | Survives page reloads without a backend; 14-day window avoids nagging |

---

## Architecture

### New files

| File | Role |
|---|---|
| `composables/usePwaInstall.ts` | All install logic — event interception, dwell timer, localStorage, iOS detection |
| `components/PwaBanner.vue` | Dark bottom-sheet UI — renders nothing until composable signals `show = true` |

### Changed files

| File | Change |
|---|---|
| `layouts/map.vue` | Add `<ClientOnly><PwaBanner /></ClientOnly>` at the bottom of the template |
| `.gitignore` | Add `.superpowers/` (brainstorm mockups, not for commit) |

---

## Composable: `usePwaInstall.ts`

### Interface

```ts
const { show, isIos, install, dismiss } = usePwaInstall()
```

| Export | Type | Description |
|---|---|---|
| `show` | `Ref<boolean>` | Whether the banner should be visible |
| `isIos` | `Ref<boolean>` | iOS detected — banner shows manual instructions instead of install button |
| `install()` | `() => void` | Triggers the native `BeforeInstallPromptEvent.prompt()` |
| `dismiss()` | `() => void` | Hides banner, writes dismiss timestamp to `localStorage` |

### Logic flow

1. **Already installed** — if `window.matchMedia('(display-mode: standalone)').matches`, exit immediately. User already has the PWA; never show the banner.
2. **Already dismissed recently** — read `localStorage.getItem('pwa-dismiss')`. If set and `Date.now() - value < 14 * 24 * 60 * 60 * 1000`, exit immediately.
3. **iOS detection** — `isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)`. On iOS, skip waiting for `beforeinstallprompt` (the event never fires); proceed directly to the dwell timer.
4. **Android/Chrome** — attach a `beforeinstallprompt` listener. When it fires, stash the event in a ref and call `event.preventDefault()` (prevents the browser from showing its own ambient prompt).
5. **Dwell timer** — 8 seconds after the composable mounts, set `show = true`. The timer is cancelled in `onUnmounted` so navigating away before 8s produces no effect.
6. **`install()`** — calls `deferredPrompt.value.prompt()`, awaits `userChoice`, then calls `dismiss()` regardless of outcome (accepted or rejected — do not nag either way).
7. **`dismiss()`** — sets `show = false`, writes `String(Date.now())` to `localStorage('pwa-dismiss')`.

### Constraint

The composable only runs client-side. It is called inside `<ClientOnly>`, so no `import.meta.client` guards are needed inside the composable.

---

## Component: `PwaBanner.vue`

Renders nothing (`v-if="show"`) until the composable activates. Uses `usePwaInstall()` internally.

### Android/Chrome layout

```
[handle bar]

🚵  Trailradar als App installieren — kostenlos
    Alle Trails immer dabei. Direkt vom Homescreen
    starten — schneller als im Browser.

    [🏠 Homescreen]  [⚡ Blitzschnell]  [🆓 Kostenlos]

    [         Jetzt installieren         ]
                   Nicht jetzt
```

### iOS layout

```
[handle bar]

🚵  Trailradar als App installieren — kostenlos
    Alle Trails immer dabei. Direkt vom Homescreen
    starten — schneller als im Browser.

    1. Tippe auf  [⎋]  (Teilen)
    2. Wähle „Zum Home-Bildschirm"

                   Schließen
```

### Visual spec

| Property | Value |
|---|---|
| Background | `#16181a` |
| Border-top | `1px solid rgba(255,255,255,0.07)` |
| Border-radius | `20px 20px 0 0` |
| Position | `fixed`, bottom-anchored, full width |
| z-index | `1000` (above Leaflet controls) |
| Handle bar | `36×4px`, `#333`, centered, `border-radius: 2px` |
| Title | `#f0f0f0`, `1rem`, weight 800 |
| Body text | `#8a9aaa` |
| Perk pills | `rgba(88,194,125,0.12)` bg, `#58c27d` text, `1px solid rgba(88,194,125,0.25)` border, `border-radius: 99px` |
| CTA button | `#58c27d` bg, `#0e0f10` text, full width, `border-radius: 10px`, weight 800 |
| Dismiss text | `#4a5568`, small, centered below button |
| Padding | `6px 16px 24px` (extra bottom padding for home-indicator on iOS) |

### Animation

Enter: `transform: translateY(100%)` → `translateY(0)`, `320ms ease-out`  
Exit: reverse (`translateY(0)` → `translateY(100%)`), triggered on dismiss before `show` is set to `false` (use `transitionend` or a fixed delay to unmount after the animation).

### Accessibility

- `role="dialog"` and `aria-label="App installieren"` on the sheet element
- Dismiss is a real `<button>`, not a `<span>` or `<div>`
- The sheet traps no focus (it is non-modal and non-blocking)

---

## Tests: `composables/usePwaInstall.test.ts`

All tests use `vi.useFakeTimers()` to control the 8-second dwell, and mock `localStorage`, `window.matchMedia`, and `navigator.userAgent`.

| Test | Assertion |
|---|---|
| Already standalone | `show` remains `false` after mount |
| Dismissed within 14 days | `show` remains `false` after 8s |
| Dismissed >14 days ago | `show` becomes `true` after 8s |
| Fresh visit, Android | `beforeinstallprompt` stashed; `show` becomes `true` after 8s |
| iOS detection | `isIos = true` when UA matches iPhone/iPad; dwell timer still fires |
| `dismiss()` | sets `show = false`; writes timestamp to localStorage |
| `install()` | calls `deferredPrompt.prompt()`; calls `dismiss()` on resolution |
| Navigate away before 8s | timer cancelled in `onUnmounted`; `show` stays `false` |
