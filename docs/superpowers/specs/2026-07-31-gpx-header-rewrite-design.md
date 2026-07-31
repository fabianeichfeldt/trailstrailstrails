# GPX header rewrite — design

## Problem

Uploaded GPX files (trails, tours, and cut tour segments) currently pass through to Supabase Storage with whatever header/metadata their source tool wrote — Komoot, Strava, etc. — including third-party branding (`creator="https://www.komoot.de"`) and sometimes sponsor text baked into `<metadata><name>` (e.g. "...sponsored by VELOVITA"). We want every GPX file that leaves TrailRadar to carry a consistent TrailRadar header instead.

## Scope

- Rewrite the GPX preamble (everything before the first `<trk>`) to a canonical TrailRadar `<gpx>`/`<metadata>`/`<author>` block, for **trails and tours** (including segments cut via the tour segment editor).
- The `<name>` value is the trail/tour's name as it stands in the UI at upload time (initially suggested from the file's own `<name>`, editable by the user before saving) — no new name-input UI needed, it already exists.
- The `<trk><name>` tag *inside* the track body is left untouched — only the preamble is replaced.
- Applies to new uploads going forward, plus a one-off backfill script for GPX files already in storage.
- No DOM/XML parsing library introduced — stays consistent with `GpxProcessor.ts`'s existing pure string/regex style.

## 1. Core function — `src/spot_manager/GpxProcessor.ts`

```ts
function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function buildGpxHeader(name: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="https://trailradar.org" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <author>
      <link href="https://trailradar.org">
        <text>Trailradar</text>
        <type>text/html</type>
      </link>
    </author>
  </metadata>
`
}

export function rewriteGpxHeader(content: string, name: string): string {
  const trkIdx = content.search(/<trk[\s>]/)
  if (trkIdx === -1) return content // no track found — leave untouched, don't corrupt the file
  const body = content.slice(trkIdx)
  return buildGpxHeader(name) + body + (body.trimEnd().endsWith('</gpx>') ? '' : '\n</gpx>')
}
```

`buildGpxXml()` (the existing generator used for cut tour segments, which currently emits no metadata block at all) is refactored to call `buildGpxHeader(name)` for its preamble, so there is one canonical header format used everywhere a GPX file is written.

## 2. Integration points

The rewrite happens **at upload time**, using whatever name is currently in the form — never inside `processGpx`, since the user can still edit the name after the file is parsed and before it's saved.

**`src/components/spotmanager/SpotManagerApp.vue`**
- `applyImports()` — before `uploadGpx(...)`, call `rewriteGpxHeader(p.processed.gpxContent, name)` and upload that instead of the raw parsed content.
- `saveTrailEdit` / `saveTourEdit` (replacing an existing trail/tour's GPX) — same treatment, using the current name field.
- Tour segment save path (`processSegment` → `buildGpxXml`) — no extra call needed; the header is baked into the generator per section 1.

**`scripts/preprocess-gpx.js` / `scripts/push-gpx.js`** (offline bulk-import CLI pipeline)
- Add the same `escapeXml` + `buildGpxHeader` + `rewriteGpxHeader` trio as plain CommonJS functions in `preprocess-gpx.js`, mirroring how `parseGpx` is already duplicated there rather than imported from `src/`.
- In `processFile()`, wrap the stored `gpx_content` through `rewriteGpxHeader(content, meta.name ?? gpxName ?? ...)` before it's written into `processed.json`, so `push-gpx.js` uploads already-rewritten content unchanged.

## 3. Backfill script — `scripts/rewrite-gpx-headers.js`

New script following `push-gpx.js`'s conventions (same env vars, same CommonJS style; added to `scripts/package.json`).

```
Env:  SUPABASE_URL, SUPABASE_SERVICE_KEY   (same as push-gpx.js)
Flag: DRY_RUN=1   → logs what would change, makes no network writes

For each of spot_gpx_trails, spot_gpx_tours (paginated REST fetch: id, spot_id, name, filename, gpx_url):
  1. Download current GPX content from gpx_url
  2. Skip if already migrated (content already contains creator="https://trailradar.org")
     — makes reruns idempotent and safe to interrupt
  3. rewritten = rewriteGpxHeader(content, row.name)
  4. Skip + warn if rewritten === content (no <trk> found — shouldn't happen, but don't
     silently corrupt a file)
  5. Derive the storage object path from gpx_url (strip the known public-URL prefix)
  6. PUT the rewritten content back to the same storage path (overwrite in place — the
     path/gpx_url never changes, so no DB row updates are needed)

Final summary: counts of rewritten / already-migrated / skipped-with-warning / failed
```

**Caveat:** this overwrites GPX files in Supabase Storage in place; Storage has no built-in versioning here, so this is not reversible without a prior backup. The script's header comment must instruct: run `npm run backup` (existing `scripts/backup.js`, which covers storage) before running for real, and always do a `DRY_RUN=1` pass first to review the diff. This script will not be run as part of implementing this feature — it's a deliberate, manually-triggered one-off once the code lands.

## 4. Testing

New vitest coverage in `src/spot_manager/GpxProcessor.test.ts`:

- `rewriteGpxHeader` replaces a Komoot-style header (existing `<metadata>` block) and preserves the `<trk>...</trk>` body byte-for-byte, including any inner `<trk><name>` (sponsor text and all).
- `rewriteGpxHeader` on a bare-bones file with no `<metadata>` block at all still inserts the canonical header correctly.
- `rewriteGpxHeader` returns content unchanged when no `<trk` tag is present (defensive fallback).
- A name containing XML-special characters (`&`, `<`, `"`) is escaped correctly in the output `<name>` tag.
- `buildGpxXml` (tour segment generator) emits the same canonical header/metadata block.

`scripts/preprocess-gpx.js` / `scripts/push-gpx.js` / `scripts/rewrite-gpx-headers.js` remain untested CLI scripts, consistent with every other script in `scripts/` (none currently have test coverage) — no new test framework is introduced there.
