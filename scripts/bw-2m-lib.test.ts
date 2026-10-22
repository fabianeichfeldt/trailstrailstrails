import { describe, expect, it } from 'vitest';
import lib from './bw-2m-lib.js';

const { readShp, readDbf, utmToWgs84, findCandidates, buildGpx, gpxFilename, buildProposal, formatReview } = lib;

// Minimal PolyLine .shp writer — just enough structure for readShp.
function makeShp(records: number[][][][]) {
  const bodies = records.map(parts => {
    const pts = parts.flat();
    const b = Buffer.alloc(44 + parts.length * 4 + pts.length * 16);
    b.writeInt32LE(3, 0);
    b.writeInt32LE(parts.length, 36);
    b.writeInt32LE(pts.length, 40);
    let start = 0;
    parts.forEach((p, i) => { b.writeInt32LE(start, 44 + i * 4); start += p.length; });
    pts.forEach(([x, y], i) => {
      b.writeDoubleLE(x, 44 + parts.length * 4 + i * 16);
      b.writeDoubleLE(y, 44 + parts.length * 4 + i * 16 + 8);
    });
    return b;
  });
  const header = Buffer.alloc(100);
  header.writeInt32BE(9994, 0);
  header.writeInt32LE(3, 32);
  const recs = bodies.map((body, i) => {
    const h = Buffer.alloc(8);
    h.writeInt32BE(i + 1, 0);
    h.writeInt32BE(body.length / 2, 4);
    return Buffer.concat([h, body]);
  });
  return Buffer.concat([header, ...recs]);
}

function makeDbf(fields: { name: string; length: number }[], rows: Record<string, string>[], deleted: number[] = []) {
  const recordLen = 1 + fields.reduce((s, f) => s + f.length, 0);
  const headerLen = 32 + fields.length * 32 + 1;
  const header = Buffer.alloc(headerLen);
  header.writeUInt32LE(rows.length, 4);
  header.writeUInt16LE(headerLen, 8);
  header.writeUInt16LE(recordLen, 10);
  fields.forEach((f, i) => {
    header.write(f.name, 32 + i * 32, 'latin1');
    header[32 + i * 32 + 16] = f.length;
  });
  header[headerLen - 1] = 0x0d;
  const recs = rows.map((row, r) => {
    const b = Buffer.alloc(recordLen, 0x20);
    if (deleted.includes(r)) b[0] = 0x2a;
    let pos = 1;
    for (const f of fields) {
      Buffer.from(row[f.name] ?? '', 'utf-8').copy(b, pos, 0, f.length);
      pos += f.length;
    }
    return b;
  });
  return Buffer.concat([header, ...recs]);
}

const FIELDS = [
  { name: 'OBJECTID', length: 20 },
  { name: 'JOIN_NAME', length: 40 },
  { name: 'JOIN_BEMER', length: 40 },
  { name: 'laenge_m', length: 11 },
];

describe('utmToWgs84', () => {
  // Reference values from proj4 2.12.1 (EPSG:25832 → EPSG:4326).
  it.each([
    [413500, 5318000, 48.00943826, 7.84019291],
    [621000, 5400000, 48.74125889, 10.6458255],
    [500000, 5300000, 47.85334195, 9],
  ])('E%d N%d → %f, %f', (e, n, lat, lng) => {
    const p = utmToWgs84(e, n);
    expect(p.lat).toBeCloseTo(lat, 7);
    expect(p.lng).toBeCloseTo(lng, 7);
  });
});

describe('shapefile reading', () => {
  it('reads multi-part polylines and their attributes, incl. umlauts and overflow fields', () => {
    const shapes = readShp(makeShp([[[[1, 2], [3, 4]], [[5, 6]]], [[[7, 8], [9, 10]]]]));
    expect(shapes).toEqual([
      { parts: [[[1, 2], [3, 4]], [[5, 6]]] },
      { parts: [[[7, 8], [9, 10]]] },
    ]);
    const rows = readDbf(makeDbf(FIELDS, [
      { OBJECTID: '17112.0000000000', JOIN_NAME: 'Großvaterwegle', laenge_m: '****' },
      { OBJECTID: '2', JOIN_NAME: 'gone' },
    ], [1]));
    expect(rows).toEqual([{ OBJECTID: '17112.0000000000', JOIN_NAME: 'Großvaterwegle', JOIN_BEMER: '', laenge_m: '' }]);
  });

  it('rejects non-polyline shapefiles', () => {
    const shp = makeShp([]);
    shp.writeInt32LE(5, 32);
    expect(() => readShp(shp)).toThrow(/PolyLine/);
  });
});

describe('findCandidates', () => {
  const trail = [{ lat: 48.0, lng: 7.8 }, { lat: 48.0, lng: 7.9 }];
  const spots = [
    { id: 'far', name: 'Far', latitude: 48.2, longitude: 7.85 },           // ~22 km
    { id: 'mid', name: 'Mid', latitude: 48.05, longitude: 7.9 },           // ~5.6 km from end point
    { id: 'near', name: 'Near', latitude: 48.0, longitude: 7.85 },         // on the line, between vertices
  ];

  it('lists every spot within the radius, nearest first, measured to the closest vertex', () => {
    const result = findCandidates(trail, spots, 10);
    expect(result.map(c => c.id)).toEqual(['near', 'mid']);
    expect(result[1].distanceKm).toBeCloseTo(5.56, 1);
  });

  it('returns nothing when no spot is in range', () => {
    expect(findCandidates(trail, spots, 1)).toEqual([]);
  });
});

describe('buildProposal → GPX + review', () => {
  // Two trails near Freiburg (E413500/N5318000 ≈ 48.009, 7.840) and one in the Odenwald far from any spot.
  const shapes = readShp(makeShp([
    [[[413500, 5318000], [413600, 5318100]]],
    [[[414000, 5318000], [414100, 5318000]]],
    [[[500000, 5480000], [500100, 5480000]]],
  ]));
  const rows = readDbf(makeDbf(FIELDS, [
    { OBJECTID: '1.0', JOIN_NAME: 'Canadian Trail', laenge_m: '141.4' },
    { OBJECTID: '2.0', JOIN_NAME: 'Borderline', JOIN_BEMER: 'Singletrail', laenge_m: '100' },
    { OBJECTID: '3.0', JOIN_NAME: 'Nowhere & Co', laenge_m: '100' },
  ]));
  const spots = [
    { id: 'fr', type: 'trail', name: 'Freiburg Trails', slug: 'freiburg', latitude: 48.01, longitude: 7.84 },
    { id: 'bp', type: 'bikepark', name: 'Bikepark Nearby', slug: 'bp', latitude: 48.05, longitude: 7.86 },
  ];
  const proposal = buildProposal(shapes, rows, spots, { radiusKm: 10 });

  it('pre-selects the nearest spot and keeps all in-range alternatives', () => {
    expect(proposal[0]).toMatchObject({ objectId: '1', name: 'Canadian Trail', lengthM: 141, spot_id: 'fr' });
    expect(proposal[0].candidates.map((c: any) => c.id)).toEqual(['fr', 'bp']);
    expect(proposal[2]).toMatchObject({ spot_id: null, candidates: [] });
  });

  it('writes a valid WGS84 GPX track per trail', () => {
    const gpx = buildGpx(proposal[2].name, proposal[2].segments, { source: 'ForstBW' });
    expect(gpx).toContain('<name>Nowhere &amp; Co</name>');
    expect(gpx).toContain('<desc>ForstBW</desc>');
    expect(gpx.match(/<trkpt /g)).toHaveLength(2);
    expect(gpx).toMatch(/<trkpt lat="49\.\d{7}" lon="9\.0000000">/);
    expect(gpx.trimEnd().endsWith('</gpx>')).toBe(true);
  });

  it('groups the review into ambiguous / single / unmatched', () => {
    const md = formatReview(proposal, { radiusKm: 10, source: 'x.shp' });
    expect(md).toMatch(/## Several spots in range \(2\)/);
    expect(md).toMatch(/## No spot in range \(1\)/);
    expect(md).toContain('**→** Freiburg Trails (trail)');
  });

  it('rejects mismatched .shp/.dbf record counts', () => {
    expect(() => buildProposal(shapes, rows.slice(1), spots)).toThrow(/records/);
  });
});

describe('gpxFilename', () => {
  it('produces storage-safe names', () => {
    expect(gpxFilename('Bock´n Soul – Großvaterwegle', '17')).toBe('bock-n-soul-grossvaterwegle_17.gpx');
  });
});
