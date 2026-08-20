# GPX Segment Editor — Feature Plan

## What we're building

A two-step wizard inside SpotManager that lets trailcrew members upload one source GPX recording and interactively carve it into trail segments using an elevation scrubber. Segments become `spot_gpx_trails` rows. The source track can optionally be saved as a `spot_gpx_tours` row with `trail_names` auto-populated from the session.

---

## Entry point

A third button in the list view alongside `+ Trail` and `+ Tour`:

```
✂ GPX aufteilen
```

Opens `view = 'segment-upload'` (step 1).

---

## Step 1 — `segment-upload` view

Single-file drop zone (no multi-file, no Trail/Tour toggle). On file load: run `processGpx()`, store the result, transition to `view = 'segment-editor'`.

---

## Step 2 — `segment-editor` view

### Layout (only active in this view)

```
┌─────────────────────────────────────────────────┐
│  sidebar (350px)  │  map (flex)                  │
│                   │                              │
│  form: name,      │  source track (dimmed)       │
│  difficulty,      │  active slice (live color)   │
│  direction        │  committed segments          │
│                   │                              │
│  [+ Segment]      │                              │
│                   │                              │
│  ── pending ───   │                              │
│  A · 1.2km · red  │                              │
│  B · 0.8km · blue │                              │
│                   │                              │
│  ☐ Als Tour       │                              │
│    speichern      │                              │
│    name / dir     │                              │
│                   │                              │
│  [Abbrechen]      │                              │
│  [Übernehmen (2)] │                              │
├───────────────────┴──────────────────────────────┤
│  elevation scrubber (~160px fixed height)        │
│  ▐══════════╠═══════════╣══════════▌             │
└─────────────────────────────────────────────────┘
```

### Elevation scrubber

- Drawn from `rawPoints` (full resolution, not thinned) — all raw track points plotted as elevation profile
- Two draggable handles on the x-axis select `startIdx` and `endIdx` into `rawPoints`
- As handles move: map updates live, showing `rawPoints[startIdx..endIdx]` as a coloured polyline (coloured by current difficulty selection)
- Source track shown dimmed behind it; already-committed segments shown as solid coloured polylines

### Adding a segment

1. User drags handles to define the slice
2. Fills in name, difficulty, direction in the sidebar form
3. Clicks `+ Segment`
4. Slice is stored in a pending list with all form values
5. Map gets a permanent coloured polyline for that segment
6. Handles reset to full range, form clears for the next segment

### Pending list

- Each entry shows: difficulty colour dot, name, distance
- Trash icon to remove (removes from list and from map)
- No edit-in-place — delete and redo

### "Als Tour speichern" checkbox

- When checked: name field (pre-filled from GPX name) and direction dropdown (cw / ccw) appear
- `trail_names` is auto-populated from all pending segment names — no opt-out needed
- Supports all three use cases:
  - Segments only, no tour → leave unchecked
  - Tour only, no segments yet → check the box, commit with empty pending list
  - Tour + segments together → define segments, then check the box

---

## Commit (Übernehmen)

### For each pending segment

1. Slice `rawPoints[startIdx..endIdx]`
2. Smooth elevation → RDP thin → compute stats (reuses existing `GpxProcessor` pure functions)
3. Generate GPX XML from thinned points
4. `uploadGpx(spotId, 'trails', name + '.gpx', gpxContent, jwt)`
5. `upsertTrail({ spot_id, name, difficulty, direction, gpx_points, gpx_url, ...stats })`

### If "Als Tour speichern" is checked

6. `uploadGpx(spotId, 'tours', tourName + '.gpx', sourceGpxContent, jwt)`
7. `upsertTour({ spot_id, name: tourName, direction: tourDir, trail_names: [all segment names], ...sourceStats })`

After commit → `view = 'list'`, new rows appear in trails and tours lists, map updated.

---

## Changes to existing files

| File | Change |
|---|---|
| `src/spot_manager/GpxProcessor.ts` | Add `processSegment(rawPoints, startIdx, endIdx)` — slices, smooths, thins, computes stats, generates GPX XML string |
| `src/spot_manager/MapView.ts` | Add `showSourceTrack(points)`, `updateLiveSlice(points, color)`, `clearLiveSlice()` |
| `components/spotmanager/SpotManagerApp.vue` | Add `'segment-upload'` and `'segment-editor'` to the `View` union; entry point button; bottom panel layout toggle; scrubber + editor logic |
| `CONTEXT.md` | Already created — defines Source track, Segment, GPX Segment Editor, Elevation scrubber |

No new API functions needed — `upsertTrail`, `upsertTour`, `uploadGpx` already cover the commit step.

No DB migrations needed — no new tables or columns.

---

## Test coverage required

- Unit tests in `GpxProcessor.test.ts`:
  - `processSegment` slice correctness (start/end boundary accuracy)
  - `processSegment` stat accuracy (distance, gain, loss match sub-slice)
  - `processSegment` GPX XML output is valid and parseable by `parseGpx`
- Unit test: `trail_names` on the committed tour equals the names of all defined segments
- Architecture test (`src/architecture.test.ts`): segment editor state stays within `SpotManagerApp.vue`, does not import `src/map/` directly

---

## What this does NOT change

- The existing `import` view (`+ Trail` / `+ Tour` flow) — untouched
- DB schema and RLS policies — `can_edit_spot()` already gates `upsertTrail` and `upsertTour`
- `matchTrailsInTour` Fréchet matching — not used here (segments are defined manually)
