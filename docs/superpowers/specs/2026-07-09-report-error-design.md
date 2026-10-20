# Report an Error — Design Spec

**Date:** 2026-07-09
**Status:** Approved

---

## Summary

A "Stimmt etwas nicht? Melden." link in the Spot-Info tab of the spot details panel (`SpotPanel`), next to the existing "Sind diese Infos hilfreich?" feedback row. Clicking it opens a modal with a freetext field (max 1000 characters) that submits to a Supabase edge function called `report`. Open to anonymous users, same as the existing thumbs up/down feedback.

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Placement | Next to existing feedback row in Spot-Info tab | Same visual area users already associate with giving feedback on a spot; avoids adding a new UI zone |
| Auth requirement | Anonymous allowed | Matches the existing thumbs up/down feedback pattern; lowers friction for reporting real problems (closed trail, wrong info) |
| Edge function scope | Client-side only | `supabase/functions/` isn't in this repo — other edge functions (`trail-details-feedback`, `add-visit`) are deployed/managed outside it. The `report` function is assumed to exist or be created separately by the user |
| Payload | `trail_id`, `trail_name`, `message`, `user_id?` | Mirrors `submitFeedback`'s minimal payload; `user_id` included only when the reporter is logged in, so follow-up is possible without requiring login |
| UI pattern | Modal dialog | The click originates in the vanilla-JS `SpotPanel`/`detailsPopup.ts` layer, which can't own Vue state directly. The codebase already has a mechanism for this: `openSignInModal()` flips a `mapStore` flag that a Vue modal (`AuthModal`) reacts to. `ReportErrorModal` follows the same mechanism |
| Success feedback | Toast + auto-close | Matches the existing feedback thumbs-up toast ("Danke für dein Feedback! 🙏"); this is a fire-and-forget report, not a flow the user needs an inline confirmation screen for |

---

## Architecture

### New files

| File | Role |
|---|---|
| `src/communication/report.ts` | `submitReport()` — POSTs to the `report` edge function, same shape as `feedback.ts`'s `submitFeedback()` |
| `src/components/map/ReportErrorModal.vue` | Teleport'd modal: textarea (max 1000 chars), live counter, Abbrechen/Senden buttons, inline error. Styled after `AddSpotModal.vue`; reads `mapStore` directly like `AuthModal.vue` |

### Changed files

| File | Change |
|---|---|
| `src/stores/map.ts` | Add `reportModalOpen`, `reportModalTrailId`, `reportModalTrailName` refs |
| `src/map/detail_popup/detailsPopup.ts` | Add `Melden` link markup next to `Sind diese Infos hilfreich?` in `renderTrailDetails()` |
| `src/map/detail_popup/logic.ts` | Bind click on the new link → `auth.openReportModal(trailId, trailName)` |
| `src/auth/auth.ts` (`Auth` class) | Add `openReportModal(trailId, trailName)` method, mirroring `openSignInModal()` |
| `src/composables/useTrailMap.ts` | Add `openReportModal` to the injected `Auth`-like adapter object: `async openReportModal(trailId, trailName) { mapStore.reportModalOpen = true; mapStore.reportModalTrailId = trailId; mapStore.reportModalTrailName = trailName }` |
| `src/pages/map.vue` | Mount `<ReportErrorModal />` next to `<AuthModal />` |

---

## Data flow

```
user clicks "Melden" (Spot-Info tab, next to feedback row)
  → logic.ts: auth.openReportModal(trailId, trailName)
  → mapStore: reportModalOpen = true, reportModalTrailId, reportModalTrailName set
  → ReportErrorModal.vue (mounted once in map.vue, reads mapStore directly)
  → user types freetext (max 1000 chars), clicks "Senden"
  → src/communication/report.ts: submitReport(trailId, trailName, message, userId?)
      POST ${FUNCTIONS}/report  { trail_id, trail_name, message, user_id? }
      headers: anonHeaders()  (anonymous allowed, no JWT required)
  → on success: showToast('Danke, wir schauen uns das an! 🙏', 'success'), modal closes
  → on failure: inline error message in modal, modal stays open, user can retry
```

`user_id` is read from the existing `authStore` (`authStore.isLoggedIn` / the user id already available there) — no new auth plumbing needed. It is omitted from the payload entirely when the user is anonymous.

---

## `src/communication/report.ts`

```ts
import { FUNCTIONS, anonHeaders } from './http'

export async function submitReport(
  trailId: string,
  trailName: string,
  message: string,
  userId?: string,
): Promise<void> {
  const res = await fetch(`${FUNCTIONS}/report`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({
      trail_id: trailId,
      trail_name: trailName,
      message,
      ...(userId ? { user_id: userId } : {}),
    }),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
}
```

---

## `ReportErrorModal.vue`

### Props / state

Self-contained like `AuthModal.vue` — no props, reads/writes `mapStore` directly:

- `mapStore.reportModalOpen: boolean` — visibility
- `mapStore.reportModalTrailId: string | null`
- `mapStore.reportModalTrailName: string | null`

Local component state: `message = ref('')`, `submitting = ref(false)`, `error = ref('')`.

### Behavior

1. Modal visible when `mapStore.reportModalOpen` is true (`v-if`, `Teleport to="body"`).
2. Title: `Fehler melden`, subtitle shows the trail name for context (`mapStore.reportModalTrailName`).
3. Textarea: `v-model="message"`, `maxlength="1000"`, placeholder `Was stimmt nicht?`.
4. Live counter below textarea: `{{ message.length }} / 1000`.
5. "Senden" button disabled when `message.trim() === ''` or `submitting`.
6. On submit: call `submitReport(mapStore.reportModalTrailId, mapStore.reportModalTrailName, message.trim(), authStore.isLoggedIn ? authStore.userId : undefined)`.
7. On success: `showToast('Danke, wir schauen uns das an! 🙏', 'success')`; reset `message`; close modal (`mapStore.reportModalOpen = false`).
8. On failure: set `error.value` to a generic message (`Senden fehlgeschlagen, bitte versuche es erneut.`); modal stays open; `submitting.value = false`.
9. "Abbrechen" button and backdrop click close the modal without submitting (reset `message`/`error` on close, same as `AddSpotModal`'s `watch(() => props.open, ...)` reset pattern — here triggered by a `watch(() => mapStore.reportModalOpen, ...)`).
10. `Escape` key closes the modal (same `onKey` pattern as `AddSpotModal.vue`).

### Visual style

Reuse `AddSpotModal.vue`'s backdrop/card/button styles directly (`.add-spot-backdrop`-equivalent, same border-radius, shadow, button colors) so the modal feels native to the app rather than introducing a new visual language. Class names prefixed `report-error-*` to avoid collisions.

---

## `detailsPopup.ts` markup change

Inside `renderTrailDetails()`, extend the existing feedback block:

```html
<div class="popup-feedback" data-trail-id="${trail.id}" data-trail-name="${trail.name}">
  <span class="feedback-label">Sind diese Infos hilfreich?</span>
  <div class="feedback-buttons">
    <button class="thumb-btn up" title="Ja, hilfreich" communication-action="upvote">
      <i class="fa-solid fa-thumbs-up"></i>
    </button>
    <button class="thumb-btn down" title="Nein" communication-action="downvote">
      <i class="fa-solid fa-thumbs-down"></i>
    </button>
  </div>
</div>
<button class="report-error-link" communication-action="report">Stimmt etwas nicht? Melden.</button>
```

`report-error-link` styled as a small muted text-button (no border, underline on hover), sitting directly below the feedback row.

---

## `logic.ts` wiring change

Inside `bindPopupEvents()`, extend the existing feedback click delegation (or add a sibling listener) to handle the new action:

```ts
const action = btn.getAttribute("communication-action");
if (action === "upvote") { /* existing */ }
if (action === "downvote") { /* existing */ }
if (action === "report") {
  await auth.openReportModal(trailId, trailName);
}
```

Since `report-error-link` sits outside `.popup-feedback` in the markup above, it needs its own `querySelector`/listener in `bindPopupEvents()`, following the same style as the existing `uploadBtn`/`loginBtn` listeners further down in that function.

---

## Tests

### `src/communication/report.test.ts`

Mirrors the structure of `feedback.test.ts` if one exists; otherwise follows `add_spot.test.ts`'s fetch-mocking style.

| Test | Assertion |
|---|---|
| Successful submit | POSTs to `${FUNCTIONS}/report` with `{ trail_id, trail_name, message }`, `anonHeaders()` |
| Successful submit, logged in | Payload includes `user_id` |
| Successful submit, anonymous | Payload has no `user_id` key |
| Server error | Throws with status + body text, matching `fetchJson`/`submitSpot` error format |

### `src/components/map/ReportErrorModal.test.ts`

| Test | Assertion |
|---|---|
| Hidden by default | Not rendered when `mapStore.reportModalOpen` is `false` |
| Visible when open | Renders trail name, textarea, counter when `mapStore.reportModalOpen` is `true` |
| Char limit | Textarea has `maxlength="1000"`; counter updates as text is typed |
| Empty message | Submit button disabled when message is empty or whitespace-only |
| Submit success | Calls `submitReport` with correct args; shows toast; closes modal; resets message |
| Submit failure | Shows inline error; modal stays open; message is preserved |
| Cancel/Escape/backdrop click | Closes modal without calling `submitReport` |

No new Playwright test — this is a straightforward form, not on the map/auth/add-spot-flow critical path per `CLAUDE.md`'s E2E trigger list. Vitest coverage is sufficient, matching the "prefer vitest" rule.

---

## Out of scope

- The `report` Supabase edge function itself (assumed to exist or be created separately, same as `trail-details-feedback` and `add-visit`).
- Rate limiting / spam protection beyond whatever the edge function does server-side — no client-side honeypot or CAPTCHA, consistent with the existing `add-spot`/`feedback` flows which have none either.
- Admin UI for viewing/triaging submitted reports.
