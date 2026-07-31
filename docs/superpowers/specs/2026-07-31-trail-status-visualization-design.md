# Trail status visualization (open / closing soon / closed)

Status: design approved by user, spec self-reviewed. Not yet implemented.

## Goal

Let trailcrew mark a GPX trail track as closed (immediately, or on a schedule) or attach a free-text hint, and surface that on the map in a way that's an immediate visual upgrade — without disturbing the existing difficulty-color encoding riders already rely on.

## Scope

- Applies at the **GPX track level** (`spot_gpx_trails` row), not the marker/spot level, and not the trail-type point marker (`createCustomIcon` / `map-pin-*`) — those are untouched.
- Whole-track granularity only. No partial/segment closures (e.g. "only the lower half is closed") — out of scope for this design.
- This spec covers **visual design + data model shape**. No migration is applied and no code is written as part of this spec; implementation happens in a separate follow-up plan.

## Non-goals

- Spot-level `trail_details.status` (open/limited/closed/unknown) is a separate, existing concept and is not changed by this feature. This feature is additive, track-specific, and independent of it.
- Rain-policy and night-riding closures (`trail_details.rain_policy`, `night_policy`) are unrelated automatic/recurring rules and are not part of this feature.
- Auto-derived "closing soon" does not use a lead-time threshold — any future `closed_from` renders the hint state immediately, no matter how far out. (Can be revisited later if it proves noisy.)

## Data model

New nullable columns on `public.spot_gpx_trails`:

```sql
ALTER TABLE public.spot_gpx_trails
  ADD COLUMN closed_from timestamptz,
  ADD COLUMN closed_to   timestamptz,
  ADD COLUMN hint        text;
```

- All three default `NULL` — an untouched row renders as plain "open," matching current behavior exactly.
- `closed_from` / `closed_to` define a schedule. **Dates are the single source of truth for closed state** — there is no separate boolean to keep in sync.
- `closed_to = NULL` means "closed indefinitely once `closed_from` arrives" (no announced reopening date).
- `hint` is free text, independent of the schedule. It's shown as the explanation text in both the "closing soon" and "closed" popup/sheet, and can also be used standalone (see derivation below).
- RLS: no policy changes needed. `spot_gpx_trails` already has row-level policies keyed on `can_edit_spot(spot_id)` for INSERT/UPDATE (admin or assigned trailcrew) and `USING (true)` for public SELECT — new columns are automatically covered by both.

### Status derivation (computed live, not stored)

Given `now()`:

| Condition | Derived state |
|---|---|
| `closed_from` set AND `now >= closed_from` AND (`closed_to IS NULL` OR `now <= closed_to`) | **Closed** |
| `closed_from` set AND `now < closed_from` | **Closing soon** |
| `closed_from IS NULL` AND `hint` set (non-empty) | **Hint** |
| Otherwise | **Open** (no badge) |

"Closing soon" and "Hint" share the same visual treatment (yellow badge, see below) — the only difference is the popup content (auto-generated date message vs. plain `hint` text). If both a schedule and a `hint` are set, `hint` is shown as the explanation text in every non-open state.

## Visual encoding

The GPX track's **difficulty-color line is never changed** — green/blue/red/black stays exactly as it is today for easy/intermediate/difficult/expert. Status is communicated purely via an additional badge.

| Derived state | Badge | Line color |
|---|---|---|
| Open | none — nothing rendered | difficulty color, untouched |
| Closing soon | yellow glossy badge, "i" glyph, soft pulsing glow | difficulty color, untouched |
| Closed | red glossy badge, "✕" glyph, static (no pulse) | difficulty color, untouched |

### Badge style

- Single badge per track, positioned at the **track's midpoint**.
- Rendered as a small (~34px) sphere: radial-gradient fill with a specular highlight near the top-left, a drop shadow for lift off the map, and a thin white inset ring for edge definition.
- Yellow (hint / closing soon) variant only: a soft looping pulse — the drop shadow's glow radius breathes between a tighter and wider blur on a ~2.2s ease-in-out cycle. Kept subtle so a map with many flagged trails doesn't feel busy.
- Red (closed) variant: same glossy sphere construction, no animation — closure is a settled fact, not something needing attention-grabbing motion.

### Interaction

Clicking/tapping the badge reveals the explanation text (auto-generated date message for "closing soon" with no `hint`, or the `hint` text verbatim when set):

- **Desktop**: a classic anchored popup bubble, consistent with existing Leaflet popup patterns elsewhere in the app.
- **Mobile**: a bottom slide-up sheet, consistent with the app's existing mobile detail-panel pattern and giving a larger touch target than a small popup bubble.

## Testing considerations (for the follow-up implementation)

Per project convention, the status-derivation logic above (open / closing soon / closed, given `closed_from`/`closed_to`/`hint` and a `now`) should be a pure function with vitest unit tests covering: no dates set, active closure with and without `closed_to`, future `closed_from` (closing soon), expired `closed_to` (back to open), and `hint`-only with no schedule.

## Follow-ups (explicitly out of scope here)

- The actual migration file, the pure derivation function, and the Leaflet rendering code (badge layer, popup/sheet components) are implementation work for a separate plan.
- Whether trailcrew edits these three columns via a new SpotManager UI section is not addressed here (SpotManager already edits `spot_gpx_trails` for GPX metadata, so this would likely extend that existing UI, but the actual UI design is future work).
