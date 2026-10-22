import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import lib from './external-import-lib.js';

const { runImport, formatReport } = lib;
const CFG = { supabaseUrl: 'http://localhost:54321', serviceKey: 'k' };
const SPOT = 'spot-1';

// ~600 m track heading north from (48, 8.0)
const track = (dLng = 0) => Array.from({ length: 7 }, (_, i) => ({ lat: 48 + i * 0.001, lng: 8 + dLng + (i % 2) * 0.0002 }));
const gpx = (pts: { lat: number; lng: number }[]) =>
  `<gpx><trk><name>x</name><trkseg>${pts.map(p => `<trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`).join('')}</trkseg></trk></gpx>`;

let dir: string;
let calls: { method: string; url: string; body?: any }[];
let existing: any[];

function stubFetch() {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, url, body: init.body });
    if (method === 'GET') return new Response(JSON.stringify(existing));
    if (url.includes('/rest/v1/spot_gpx_trails') && method === 'POST') return new Response(JSON.stringify([{ id: 'new-id' }]));
    return new Response('{}');
  }));
}

function writeImport(entries: any[]) {
  entries.forEach((e, i) => {
    const f = `gpx/${i}.gpx`;
    fs.mkdirSync(path.join(dir, 'gpx'), { recursive: true });
    fs.writeFileSync(path.join(dir, f), gpx(e.pts ?? track()));
    e.gpx = f;
    delete e.pts;
  });
  const p = path.join(dir, 'import.json');
  fs.writeFileSync(p, JSON.stringify({ source: 'bw_2m', entries }));
  return p;
}

const entry = (o: any = {}) => ({ source_id: '{AAAA-1111}', change: 'new', name: 'Neckarcoaster', spot_id: SPOT,
  difficulty: 'red', on_conflict: 'skip', ...o });
const writes = () => calls.filter(c => c.method !== 'GET');
const existingRow = (o: any = {}) => ({ id: 'row-1', spot_id: SPOT, name: 'Other', difficulty: 'blue', direction: 'both',
  source: null, source_id: null, sort_order: 3, gpx_points: [[0, 0, 0], [0, 0.001, 0]], ...o });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-import-'));
  existing = [];
  stubFetch();
});
afterEach(() => { vi.unstubAllGlobals(); fs.rmSync(dir, { recursive: true, force: true }); });

describe('import-external-trails', () => {
  it('skips entries without difficulty / spot / unchanged, with reasons, and writes nothing for them', async () => {
    const p = writeImport([
      entry({ difficulty: null, name: 'A' }), entry({ spot_id: null, name: 'B', source_id: 'b' }),
    ]);
    const r = await runImport(p, { ...CFG, apply: true });
    expect(r.skipped).toEqual({ 'no difficulty': ['A'], 'no spot': ['B'] });
    expect(writes()).toEqual([]);
    const text = formatReport(r);
    expect(text).toContain('no difficulty: 1');
  });

  it('inserts a new trail with one-way-down default, source identity and next sort_order', async () => {
    existing = [existingRow({ name: 'Elsewhere', gpx_points: [[10, 10, 0], [10, 10.001, 0]] })];
    const p = writeImport([entry({ direction: undefined })]);
    const r = await runImport(p, { ...CFG, apply: true });
    expect(r.inserted).toEqual([{ name: 'Neckarcoaster', id: 'new-id' }]);
    const post = writes().find(c => c.url.endsWith('/rest/v1/spot_gpx_trails'))!;
    const body = JSON.parse(post.body);
    expect(body).toMatchObject({ direction: 'one-way-down', source: 'bw_2m', source_id: '{AAAA-1111}', sort_order: 4,
      difficulty: 'red', spot_id: SPOT, elevation_gain: null });
    expect(body.distance_km).toBeGreaterThan(0.5);
    expect(writes().some(c => c.url.includes('/storage/v1/object/gpx-files/spot-1/trails/'))).toBe(true);
  });

  it('skips a source_id conflict by default and flags it', async () => {
    existing = [existingRow({ name: 'Neckarcoaster', source: 'bw_2m', source_id: '{AAAA-1111}' })];
    const r = await runImport(writeImport([entry({ change: 'changed' })]), { ...CFG, apply: true });
    expect(writes()).toEqual([]);
    expect(r.conflicts).toMatchObject([{ kind: 'source_id', existingId: 'row-1', decision: 'skip' }]);
    expect(formatReport(r)).toContain('row row-1');
  });

  it('replaces the conflicting row with on_conflict=replace and adopts the source', async () => {
    existing = [existingRow({ name: 'Neckarcoaster', source: 'bw_2m', source_id: '{AAAA-1111}' })];
    const r = await runImport(writeImport([entry({ change: 'changed', on_conflict: 'replace', difficulty: 'black' })]), { ...CFG, apply: true });
    const patch = writes().find(c => c.method === 'PATCH')!;
    expect(patch.url).toContain('id=eq.row-1');
    expect(JSON.parse(patch.body)).toMatchObject({ source: 'bw_2m', source_id: '{AAAA-1111}', difficulty: 'black' });
    expect(writes().some(c => c.method === 'POST' && c.url.endsWith('/rest/v1/spot_gpx_trails'))).toBe(false);
    expect(r.replaced).toHaveLength(1);
  });

  it('flags a hand-uploaded track with the same name (diacritics/case-insensitive) and skips it', async () => {
    existing = [existingRow({ name: 'NECKARCÖASTER', gpx_points: [[10, 10, 0], [10, 10.001, 0]] })];
    const r = await runImport(writeImport([entry({ name: 'neckarcoaster' })]), { ...CFG, apply: true });
    expect(writes()).toEqual([]);
    expect(r.conflicts).toMatchObject([{ kind: 'name', existingName: 'NECKARCÖASTER', decision: 'skip' }]);
  });

  it('flags a hand-uploaded track with essentially the same geometry under another name', async () => {
    const pts = track();
    existing = [existingRow({ name: 'My Own Name', gpx_points: pts.map(p => [p.lat + 0.00005, p.lng, 0]) })];
    const r = await runImport(writeImport([entry()]), { ...CFG, apply: true });
    expect(writes()).toEqual([]);
    expect(r.conflicts).toMatchObject([{ kind: 'geometry', existingName: 'My Own Name' }]);
  });

  it('does not flag a different track on the same spot', async () => {
    existing = [existingRow({ name: 'Different', gpx_points: track(0.01).map(p => [p.lat, p.lng, 0]) })];
    const r = await runImport(writeImport([entry()]), { ...CFG, apply: true });
    expect(r.conflicts).toEqual([]);
    expect(r.inserted).toHaveLength(1);
  });

  it('never writes removed entries and lists them', async () => {
    const r = await runImport(writeImport([entry({ change: 'removed', name: 'Gone' })]), { ...CFG, apply: true });
    expect(writes()).toEqual([]);
    expect(r.removed).toEqual(['Gone']);
    expect(formatReport(r)).toContain('Removed from source (check approval!): 1');
  });

  it('dry run performs no POST/PATCH/PUT but reports what would happen', async () => {
    existing = [existingRow({ name: 'Neckarcoaster', source: 'bw_2m', source_id: 'rep' })];
    const p = writeImport([entry({ source_id: 'rep', on_conflict: 'replace' }), entry({ source_id: 'new', name: 'Fresh', pts: track(0.02) })]);
    const r = await runImport(p, { ...CFG, apply: false });
    expect(writes()).toEqual([]);
    expect(r.inserted).toHaveLength(1);
    expect(r.replaced).toHaveLength(1);
    const text = formatReport(r);
    expect(text).toContain('DRY RUN');
    expect(text).toContain('would be replaced');
  });
});

describe('unchanged entries', () => {
  // "unchanged" only means the dataset didn't change since the last build — not that it was ever imported.
  it('inserts an unchanged entry that has no row yet', async () => {
    const p = writeImport([entry({ change: 'unchanged' })]);
    const r = await runImport(p, { ...CFG, apply: true });
    expect(r.inserted).toEqual([{ name: 'Neckarcoaster', id: 'new-id' }]);
  });

  it('skips an unchanged, already imported entry quietly (no conflict line)', async () => {
    existing = [existingRow({ source: 'bw_2m', source_id: '{AAAA-1111}' })];
    const p = writeImport([entry({ change: 'unchanged' })]);
    const r = await runImport(p, { ...CFG, apply: true });
    expect(r.skipped).toEqual({ 'unchanged, already imported': ['Neckarcoaster'] });
    expect(r.conflicts).toEqual([]);
    expect(writes()).toEqual([]);
  });
});

describe('formatReport elevation hint', () => {
  const base = { source: 'bw_2m', skipped: {}, conflicts: [], removed: [], failed: [], spotIds: new Set([SPOT]) };

  it('scopes the DEM backfill to the imported rows, never the whole spot', () => {
    const text = formatReport({ ...base, apply: true, inserted: [{ name: 'A', id: 'row-a' }], replaced: [{ name: 'B', id: 'row-b' }] });
    expect(text).toContain('ROW_IDS=row-a,row-b npm run backfill-dem-elevation-dry');
    expect(text).not.toContain('SPOT_ID=');
  });
});
