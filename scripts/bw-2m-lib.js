// Pure core of the BW "2-Meter-Regel" trail import: shapefile reading, UTM→WGS84, spot matching, GPX output.
// No GIS dependencies — the dataset is a plain PolyLine shapefile in EPSG:25832.

const { buildGpxHeader, escapeXml } = require('./gpx-header');

// ── Shapefile ────────────────────────────────────────────────────────────────

const SHP_POLYLINE = 3;

// Returns one entry per record: { parts: [[[x, y], ...], ...] } (null-shape records → parts: []).
function readShp(buf) {
  if (buf.readInt32BE(0) !== 9994) throw new Error('not a shapefile (.shp magic mismatch)');
  const shapeType = buf.readInt32LE(32);
  if (shapeType !== SHP_POLYLINE) throw new Error(`unsupported shape type ${shapeType} (only PolyLine)`);
  const records = [];
  let off = 100;
  while (off + 8 <= buf.length) {
    const contentBytes = buf.readInt32BE(off + 4) * 2;
    const rec = off + 8;
    const type = buf.readInt32LE(rec);
    if (type === 0) {
      records.push({ parts: [] });
    } else {
      const numParts = buf.readInt32LE(rec + 36);
      const numPoints = buf.readInt32LE(rec + 40);
      const partStarts = [];
      for (let i = 0; i < numParts; i++) partStarts.push(buf.readInt32LE(rec + 44 + i * 4));
      const pts = rec + 44 + numParts * 4;
      const parts = partStarts.map((start, i) => {
        const end = i + 1 < numParts ? partStarts[i + 1] : numPoints;
        const coords = [];
        for (let p = start; p < end; p++) coords.push([buf.readDoubleLE(pts + p * 16), buf.readDoubleLE(pts + p * 16 + 8)]);
        return coords;
      });
      records.push({ parts });
    }
    off = rec + contentBytes;
  }
  return records;
}

// dBase III attribute table → array of { field: string } (numbers stay strings; caller decides).
function readDbf(buf, encoding = 'utf-8') {
  const numRecords = buf.readUInt32LE(4);
  const headerLen = buf.readUInt16LE(8);
  const recordLen = buf.readUInt16LE(10);
  const decoder = new TextDecoder(encoding);
  const fields = [];
  for (let off = 32; buf[off] !== 0x0d; off += 32) {
    fields.push({ name: decoder.decode(buf.subarray(off, off + 11)).replace(/\0.*$/s, ''), length: buf[off + 16] });
  }
  const rows = [];
  for (let r = 0; r < numRecords; r++) {
    const rec = headerLen + r * recordLen;
    if (buf[rec] === 0x2a) continue; // '*' = deleted record
    const row = {};
    let pos = rec + 1;
    for (const f of fields) {
      const value = decoder.decode(buf.subarray(pos, pos + f.length)).trim();
      row[f.name] = /^\*+$/.test(value) ? '' : value; // '****' = numeric overflow / null
      pos += f.length;
    }
    rows.push(row);
  }
  return rows;
}

// ── Projection ───────────────────────────────────────────────────────────────

// Inverse transverse Mercator (Krüger series, GRS80) — sub-millimetre for UTM zones.
function utmToWgs84(easting, northing, zone = 32) {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996;
  const n = f / (2 - f);
  const A = a / (1 + n) * (1 + n * n / 4 + n ** 4 / 64);
  const beta = [
    n / 2 - 2 * n * n / 3 + 37 * n ** 3 / 96,
    n * n / 48 + n ** 3 / 15,
    17 * n ** 3 / 480,
  ];
  const delta = [
    2 * n - 2 * n * n / 3 - 2 * n ** 3,
    7 * n * n / 3 - 8 * n ** 3 / 5,
    56 * n ** 3 / 15,
  ];
  const xi = northing / (k0 * A);
  const eta = (easting - 500000) / (k0 * A);
  let xiP = xi, etaP = eta;
  for (let j = 1; j <= 3; j++) {
    xiP -= beta[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etaP -= beta[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
  let phi = chi;
  for (let j = 1; j <= 3; j++) phi += delta[j - 1] * Math.sin(2 * j * chi);
  const lon0 = (zone * 6 - 183) * Math.PI / 180;
  const lambda = lon0 + Math.atan2(Math.sinh(etaP), Math.cos(xiP));
  return { lat: phi * 180 / Math.PI, lng: lambda * 180 / Math.PI };
}

// ── Geometry ─────────────────────────────────────────────────────────────────

function haversineKm(a, b) {
  const R = 6371.0088;
  const rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Spots whose marker lies within radiusKm of any track vertex, nearest first.
// Distance to the closest vertex (not the start point) so a spot beside the middle of a long trail still ranks right.
function findCandidates(points, spots, radiusKm = 10) {
  return spots
    .map(spot => {
      const at = { lat: spot.latitude, lng: spot.longitude };
      const distanceKm = Math.min(...points.map(p => haversineKm(p, at)));
      return { ...spot, distanceKm: Math.round(distanceKm * 100) / 100 };
    })
    .filter(c => c.distanceKm <= radiusKm)
    .sort((x, y) => x.distanceKm - y.distanceKm);
}

// ── GPX ──────────────────────────────────────────────────────────────────────

// One <trkseg> per shapefile part; 7 decimals ≈ 1 cm.
function buildGpx(name, segments, { source } = {}) {
  const fmt = v => v.toFixed(7);
  const segs = segments.map(seg =>
    `    <trkseg>\n${seg.map(p => `      <trkpt lat="${fmt(p.lat)}" lon="${fmt(p.lng)}"></trkpt>`).join('\n')}\n    </trkseg>`,
  ).join('\n');
  const desc = source ? `\n    <desc>${escapeXml(source)}</desc>` : '';
  return `${buildGpxHeader(name)}  <trk>\n    <name>${escapeXml(name)}</name>${desc}\n${segs}\n  </trk>\n</gpx>\n`;
}

function gpxFilename(name, objectId) {
  const slug = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'trail';
  return `${slug}_${objectId}.gpx`;
}

// ── Import ───────────────────────────────────────────────────────────────────

// Joins geometry + attributes, reprojects and attaches spot candidates. Pure: no I/O.
function buildProposal(shapes, rows, spots, { radiusKm = 10, zone = 32 } = {}) {
  if (shapes.length !== rows.length) throw new Error(`.shp has ${shapes.length} records but .dbf has ${rows.length}`);
  return shapes.map((shape, i) => {
    const row = rows[i];
    const segments = shape.parts.map(part => part.map(([x, y]) => utmToWgs84(x, y, zone)));
    const points = segments.flat();
    const objectId = String(parseInt(row.OBJECTID, 10) || i);
    const name = row.JOIN_NAME || `Unbenannt ${objectId}`;
    const candidates = points.length ? findCandidates(points, spots, radiusKm) : [];
    return {
      objectId,
      guid: row.GUID || null,
      name,
      lengthM: row.laenge_m ? Math.round(parseFloat(row.laenge_m)) : null,
      note: row.JOIN_BEMER || null,
      start: points[0] ?? null,
      segments,
      file: gpxFilename(name, objectId),
      candidates: candidates.map(({ id, type, name: spotName, slug, distanceKm }) => ({ id, type, name: spotName, slug, distanceKm })),
      // Pre-filled with the nearest spot; review.md is where a human confirms or changes it.
      spot_id: candidates[0]?.id ?? null,
    };
  });
}

function formatReview(proposal, { radiusKm, source }) {
  const matched = proposal.filter(t => t.candidates.length);
  const ambiguous = matched.filter(t => t.candidates.length > 1);
  const unmatched = proposal.filter(t => !t.candidates.length);
  const mapLink = p => p ? `[${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}](https://www.openstreetmap.org/?mlat=${p.lat.toFixed(5)}&mlon=${p.lng.toFixed(5)}#map=15/${p.lat.toFixed(5)}/${p.lng.toFixed(5)})` : '–';
  const lines = [
    '# BW 2m-Trails → TrailRadar spot proposal',
    '',
    `Source: \`${source}\` · search radius ${radiusKm} km · ${proposal.length} trails`,
    '',
    `- **${matched.length - ambiguous.length}** with exactly one spot in range`,
    `- **${ambiguous.length}** with several spots in range (nearest pre-selected — check these)`,
    `- **${unmatched.length}** with no spot in range (new-spot candidates)`,
    '',
    'Edit `spot_id` in `proposal.json` to change an assignment; set it to `null` to skip a trail.',
    '',
  ];
  const section = (title, items) => {
    lines.push(`## ${title} (${items.length})`, '');
    for (const t of items) {
      lines.push(`### ${t.name}`, '', `- ${t.lengthM ?? '?'} m · start ${mapLink(t.start)} · \`gpx/${t.file}\`${t.note ? ` · _${t.note}_` : ''}`);
      for (const c of t.candidates) {
        lines.push(`  - ${c.id === t.spot_id ? '**→**' : '◦'} ${c.name} (${c.type}) — ${c.distanceKm} km · \`${c.id}\``);
      }
      lines.push('');
    }
  };
  section('Several spots in range', ambiguous);
  section('One spot in range', matched.filter(t => t.candidates.length === 1));
  section('No spot in range', unmatched);
  return lines.join('\n');
}

module.exports = { readShp, readDbf, utmToWgs84, haversineKm, findCandidates, buildGpx, gpxFilename, buildProposal, formatReview };
