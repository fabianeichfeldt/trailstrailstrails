/**
 * gpx-header.js
 *
 * Shared canonical GPX header/metadata rewriting logic, used by both
 * preprocess-gpx.js (new bulk imports) and rewrite-gpx-headers.js
 * (one-off backfill of GPX files already in Supabase Storage) so the
 * two scripts can't drift out of sync with each other.
 *
 * Mirrors the TypeScript implementation in src/spot_manager/GpxProcessor.ts
 * (kept as a separate implementation there — different runtime/module
 * system, not worth sharing across the Vite/Node boundary).
 *
 * No DOM/XML parsing library — stays consistent with GpxProcessor.ts's
 * pure string/regex style.
 */

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function buildGpxHeader(name) {
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
`;
}

function rewriteGpxHeader(content, name) {
  const trkIdx = content.search(/<trk[\s>]/);
  if (trkIdx === -1) return content; // no track found — leave untouched, don't corrupt the file
  const body = content.slice(trkIdx);
  return buildGpxHeader(name) + body + (body.trimEnd().endsWith('</gpx>') ? '' : '\n</gpx>');
}

module.exports = { escapeXml, buildGpxHeader, rewriteGpxHeader };
