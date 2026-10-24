# External trail import (recurring, multi-source)

Official trail datasets (first: ForstBW "2-Meter-Regel" shapefile) imported as `spot_gpx_trails` rows, re-runnable
whenever a source publishes a new release. Replaces the one-off `scripts/import-bw-2m.js` from commit 50d08d7.

## Decisions (2026-10-22)

- **Split:** `../trail-scraper` builds an **import file** (no DB writes). The import into Supabase happens **here**, in `scripts/`.
- **Stable identity:** `spot_gpx_trails` gets `source` + `source_id` (unique together). BW uses the shapefile `GUID`,
  not `OBJECTID` (ArcGIS renumbers it on export). A geometry fingerprint (rounded start/end + length) catches a GUID that
  changed between releases.
- **Permanent decisions** live in `trail-scraper/external_mapping.json` (committed), keyed `<source>:<source_id>`:
  spot assignment or `skip`, manual difficulty/direction, conflict decision, last seen fingerprint. Needed besides the DB
  columns because skips and unassigned trails never get a DB row.
- **Difficulty:** scraped from the operator page where it names the trail (evidence-verified); otherwise entered by hand
  in the import file. **No difficulty → entry skipped at import.**
- **Conflicts:** if the trail already exists (same `source`/`source_id`, or a hand-uploaded track on the same spot that
  matches by geometry/name), the import flags it explicitly. Decided case by case; **default skip — trailcrew wins.**
- **Removed from source:** flagged only, never deleted (may mean a revoked 2-m-rule approval).

- **Direction:** scraped or manual if known, otherwise defaults to `one-way-down` (same default as the SpotManager).

## Import file contract (`trail-scraper/out/<source>/<timestamp>/import.json`)

```jsonc
{
  "source": "bw_2m",
  "source_label": "ForstBW / Land Baden-Württemberg – genehmigte MTB-Trails (2-Meter-Regel)",
  "dataset": { "file": "…shp", "sha256": "…" },
  "generated_at": "ISO",
  "entries": [{
    "source_id": "{10F74183-…}",
    "fingerprint": "…",
    "change": "new | changed | unchanged | removed",
    "name": "Neckarcoaster",
    "spot_id": "uuid | null",            // null = unassigned → skipped
    "candidates": [{ "id", "type", "name", "distanceKm" }],
    "difficulty": "green|blue|red|black|double-black|null",   // edit by hand if null
    "difficulty_origin": "scraped | manual | null",
    "difficulty_evidence": "verbatim quote | null",
    "direction": "cw|ccw|one-way-down|one-way-up|both",  // default one-way-down
    "on_conflict": "skip | replace",     // default skip; the importer fills `conflict` in its report
    "gpx": "gpx/neckarcoaster_<id>.gpx",
    "length_m": 1041
  }]
}
```

The import file is the editing surface. Before regenerating, `external_trails.py build` writes every hand edit in the
previous import file (`spot_id`, `difficulty`, `direction`, `on_conflict`) back into `external_mapping.json`, so edits
survive re-runs.

## Steps

| # | Repo | Step | Model | Wave |
|---|---|---|---|---|
| 1 | trailradar | Migration: `source text`, `source_id text` on `spot_gpx_trails` + unique index `(source, source_id) WHERE source IS NOT NULL`; PGlite migration test. User regenerates `database.types.ts`. | haiku | 1 |
| 2 | trail-scraper | `sources/bw_2m/adapter.py`: port `bw-2m-lib.js` (shp/dbf read, UTM→WGS84, GPX write) → `features() -> [{source_id, name, segments, length_m, fingerprint}]`. Port its tests to pytest. | haiku | 1 |
| 3 | trail-scraper | `analyze_trails.py`: add `trails: [{name, difficulty, direction, evidence}]` to the strict schema; evidence verified like `rules`; no evidence → dropped. Update CLAUDE.md output format. | sonnet | 1 |
| 4 | trail-scraper | `external_trails.py build <source> <dataset>`: absorb hand edits → load mapping → diff vs. last fingerprints (new/changed/unchanged/removed) → spot candidates (10 km, `trails.json`/parks inputs) → difficulty/direction from `trail_analysis.jsonl` (fuzzy name match within the assigned spot) → write `import.json`, `gpx/`, `review.md` (unassigned / missing difficulty / removed first). Archive previous output like the other scripts. | sonnet | 2 |
| 5 | trailradar | `scripts/import-external-trails.js <import.json>`: dry-run by default, `--apply` writes. Per entry: skip (no spot / no difficulty / `unchanged`), detect conflict (same `source_id` row, or same-spot track matching by geometry/name), honour `on_conflict` (default skip; `replace` updates the row and adopts `source`/`source_id`), otherwise thin points like `preprocess-gpx.js`, upload GPX to storage, insert, then DEM elevation (`backfill-dem-elevation.js` path). Prints a report: inserted / replaced / skipped-by-reason / conflicts / removed-from-source. Vitest with HTTP mocked. Delete `import-bw-2m.js` + `bw-2m-lib.*`. | sonnet | 2 |
| 6 | both | End-to-end dry run on the real BW shapefile; review report; then `--apply` on a handful of trails. | — (me) | 3 |

Done checks: trailradar `npm test`; trail-scraper `.venv/bin/python tests/test_*.py` and `bench/test_evidence.py` (plain scripts, no pytest).

## Status (2026-10-22)

Steps 1–5 done (trail-scraper branch `fabianeichfeldt/external-import`). Step 6 done locally (real shapefile → build → hand edit →
rebuild → importer dry run against a stubbed empty DB). Still open:
- apply the migration to Supabase, regenerate `database.types.ts`
- re-run `analyze_trails.py` (one full paid run, cache key changed) so per-trail difficulties exist
- live dry run: `npm run import-external-trails -- <import.json>`, then `--apply` on a handful of trails, then the printed `ROW_IDS=… backfill-dem-elevation`

Notes: `unchanged` is skipped by the importer only when a row with that `source_id` exists. Verbal grades
("leicht", "schwer") are not mapped to colours. A hand-set `spot_id: null` becomes a permanent `skip`.
