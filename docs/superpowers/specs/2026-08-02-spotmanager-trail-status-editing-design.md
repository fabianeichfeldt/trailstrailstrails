# SpotManager: per-trail status editing (open / hint / closed)

## Context

The per-trail closure feature (open / closing-soon / closed, derived from
`closed_from` / `closed_to` / `hint` on `spot_gpx_trails`) is already fully
built end-to-end for **display**: schema, pure derivation logic
(`src/types/TrailStatus.ts`, `deriveTrailStatus`), and three render sites
(map marker badge, popup/sheet, spot panel trail rows).

What's missing is the **write side** for trailcrew: SpotManager's trail list
has no badge showing current status, and the Edit Trail form has no fields
for `closed_from` / `closed_to` / `hint` — even though `GpxTrailRow` and
`upsertTrail()` in `src/spot_manager/Api.ts` already support reading and
writing them. This is a pure front-end feature; no migration is needed.

## Goals

- Trailcrew can see, at a glance, which trails of a spot are open, have a
  hint, or are closed — from the trail list, without entering edit mode.
- Trailcrew can close a trail three ways, expressed as two plain optional
  datetime fields rather than separate modes:
  - leave both empty → not closed
  - set only a start (**Von**) → closed from that moment, indefinitely,
    until manually reopened
  - set start and end (**Von** + **Bis**) → closed for that exact window,
    auto-reopens after **Bis** (per existing derivation logic)
- Trailcrew can reopen a closed trail, or change its dates, from the same
  form.
- Trailcrew can write or remove a free-text hint, independent of the
  open/closed schedule.
- All of this is stored in `spot_gpx_trails.closed_from` / `closed_to` /
  `hint` via the existing `upsertTrail()` API function.

## Non-goals

- No changes to `deriveTrailStatus`, the map, the popup/sheet, or the spot
  panel — this feature only adds a write UI on top of what already exists.
- No new database columns, tables, or RLS policies.
- No bulk-editing of status across multiple trails at once.

## Design

### 1. Data model — unchanged

`spot_gpx_trails` already has `closed_from timestamptz`, `closed_to
timestamptz`, `hint text` (migration
`20260731100000_add_gpx_trail_status_columns.sql`). `Api.ts`'s
`GpxTrailRow` interface and `upsertTrail(row, jwt)` already accept partial
writes to these fields — confirmed no `Api.ts` changes are required.

### 2. Trail list badge

Each row in the SpotManager trail list (`SpotManagerApp.vue`, list view)
gets a small colored badge, computed client-side via:

```ts
deriveTrailStatus({ closed_from, closed_to, hint }, new Date())
```

imported directly from `src/types/TrailStatus.ts` — the same pure function
that drives the live map badge/sheet/panel, so the SpotManager badge can
never disagree with what riders actually see on the map.

Colors reuse the existing per-spot `STATUS_OPTIONS` palette already defined
in `SpotManagerApp.vue` (distinct from the map's own gold/red gradient
system, which has no green):

| `state` | Label | Color |
|---|---|---|
| `open` | Offen | `#2e7d32` (green) |
| `closing_soon` | Hinweis | `#e65100` (orange) |
| `closed` | Gesperrt | `#c62828` (red) |

Note `closing_soon` covers both the "scheduled future closure" and
"hint-only" cases per the existing derivation table — both render as the
orange "Hinweis" badge in this compact list context (the fuller
"Bald gesperrt" vs "Hinweis" distinction only matters in the rider-facing
title text, not here).

### 3. Edit Trail form — new "Status" section

Extends the existing `edit-trail` view in `SpotManagerApp.vue`, appended
below the current Beschreibung field. Implemented as a small, presentational
child component — **`src/components/spotmanager/TrailStatusFields.vue`** —
following the same extraction precedent as `ParkingEditor.vue`: it owns no
API calls or save logic, just local editable state exposed via
props/emits, so it can be unit-tested in isolation with
`@vue/test-utils`.

Fields:

- **Von** — `<input type="datetime-local">`, optional. A "Jetzt" button
  next to it fills the current local datetime.
- **Bis** — `<input type="datetime-local">`, **disabled** until Von has a
  value (prevents the otherwise-silently-ignored "Bis without Von" case,
  since `deriveTrailStatus` ignores `closed_to` entirely when `closed_from`
  is unset). A "Morgen" button fills 23:59 of the next calendar day.
  Clearing Von also clears Bis (keeps the pair always valid).
- Helper text, shown only when Von is set and Bis is empty:
  *"Ohne Enddatum bleibt der Trail gesperrt, bis du ihn hier wieder
  öffnest."*
- **"Sperrung aufheben"** button/link — clears both Von and Bis in one
  click. This is the reopen action; changing dates is just editing the
  same two fields directly.
- **Hinweis** — `<textarea>`, optional, independent of Von/Bis,
  `maxlength="300"` with a `{{ text.length }}/300` counter, matching the
  existing per-spot hint field's counter convention. Clearing the text
  removes the hint.

### 4. Save flow

No new save action. The existing single `Speichern` button in the
edit-trail view continues to call `saveTrailEdit()` →
`upsertTrail()`, now including `closed_from` / `closed_to` / `hint` in the
payload alongside name/difficulty/direction/description.

Conversion:
- `datetime-local` value (local time, no timezone) → ISO 8601 string via
  `new Date(value).toISOString()` before sending; empty string → `null`.
- On load, `openEditTrail(id)` converts the stored ISO timestamp back to
  a `datetime-local`-formatted local string to pre-fill Von/Bis.

### 5. Validation

- On save: if Bis is set, it must be strictly after Von — show an inline
  error and block save if not. (Belt-and-suspenders: the UI already
  prevents Bis-without-Von by disabling the field, and the datetime
  pickers' natural ordering makes an inverted pair unlikely, but this is
  cheap to check.)
- Hint length is capped at the input level (`maxlength="300"`), so no
  separate save-time check is needed.

### 6. Testing

Per `CLAUDE.md`, every new feature needs a corresponding test, vitest
preferred:

- **`TrailStatusFields.test.ts`** (new, `@vue/test-utils`, mirrors
  `ParkingEditor.test.ts`'s style): Jetzt button fills current datetime
  into Von; Morgen button fills 23:59 next day into Bis; Bis is disabled
  when Von is empty and enabled once Von is set; clearing Von also clears
  Bis; "Sperrung aufheben" clears both; hint counter reflects length and
  respects the 300-char cap; component emits the right payload shape for
  parent consumption.
- **`SpotManagerApp` save-path tests** (extend existing coverage or add
  focused unit tests around `saveTrailEdit()`'s payload construction):
  no-closure case sends `null`/`null`/`null`, Von-only case, Von+Bis case,
  hint-only case, and the Bis-after-Von validation error case.
- **List badge**: unit test that the list renders the correct badge
  label/class for `open` / `closing_soon` / `closed` trails, given it's a
  thin wrapper around the already-fully-tested `deriveTrailStatus`.
- No changes needed to `TrailStatus.test.ts` — the derivation logic itself
  is untouched.

## Open questions / assumptions carried into implementation

None outstanding — all placement, UI shape, color scheme, tomorrow-button
semantics, and hint length were confirmed with the user during design.
