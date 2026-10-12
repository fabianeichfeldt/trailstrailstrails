import { describe, expect, it } from 'vitest';
import lib from './trail-details-lib.js';

const { applyDetails, createClient, diffDetails, formatReview, pickDetailFields, revertEntry } = lib;

// Minimal in-memory PostgREST: just the filters/verbs the import script uses.
function fakeSupabase(seed: { trail_details?: any[]; parking?: any[]; trailcrew_spots?: any[] } = {}) {
  const db: Record<string, any[]> = {
    trail_details: structuredClone(seed.trail_details ?? []),
    parking: structuredClone(seed.parking ?? []),
    trailcrew_spots: structuredClone(seed.trailcrew_spots ?? []),
  };
  const writes: string[] = [];
  let nextId = 1;

  const fetchImpl = async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const table = url.pathname.split('/').pop()!;
    const filters = [...url.searchParams].filter(([k]) => !['select', 'limit'].includes(k))
      .map(([k, v]) => [k, decodeURIComponent(v.replace(/^eq\./, ''))]);
    const match = (row: any) => filters.every(([k, v]) => String(row[k]) === v);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body as string) : null;
    const json = (data: unknown) => new Response(data === null ? '' : JSON.stringify(data), { status: 200 });
    if (method !== 'GET') writes.push(`${method} ${table}`);

    if (method === 'GET') return json(db[table].filter(match));
    if (method === 'PATCH') {
      db[table].filter(match).forEach(row => Object.assign(row, body));
      return json(null);
    }
    if (method === 'DELETE') {
      db[table] = db[table].filter(row => !match(row));
      return json(null);
    }
    if (table === 'trail_details') {
      if (Object.keys(body).some(k => !['trail_id', 'status', 'rules', 'trail_description', 'access_type'].includes(k))) {
        return new Response('PGRST204 unknown column', { status: 400 });
      }
      const existing = db.trail_details.find(r => r.trail_id === body.trail_id);
      if (existing) Object.assign(existing, body);
      else db.trail_details.push({ last_update: '2026-01-01', ...body });
      return json(null);
    }
    const row = { id: `p${nextId++}`, ...body };
    db[table].push(row);
    return json([row]);
  };

  return { db, writes, client: createClient({ url: 'http://localhost:54321', key: 'test', fetch: fetchImpl }) };
}

const existingRow = {
  trail_id: 't1', status: 'open', rules: ['Helm tragen'], trail_description: 'Alt', access_type: 'free', last_update: '2026-01-01',
};

const scraped = {
  trail_id: 't1', name: 'Testtrail', status: 'open', rules: ['Helm tragen', 'Nicht bei Nässe'], trail_description: 'Neu',
  access_type: 'free', evidence: { status: null }, confidence: { overall: 1 }, parking: [], gps_links: [],
};

describe('pickDetailFields', () => {
  it('drops scraper-only keys like evidence that trail_details has no column for', () => {
    const { payload, dropped } = pickDetailFields(scraped);
    expect(payload).not.toHaveProperty('evidence');
    expect(dropped).toEqual(expect.arrayContaining(['name', 'evidence', 'confidence', 'parking', 'gps_links']));
  });
});

describe('diffDetails', () => {
  it('reports only fields that actually change, comparing json structurally', () => {
    const changes = diffDetails({ ...existingRow, rules: ['Helm tragen'] }, { trail_id: 't1', rules: ['Helm tragen'], status: 'closed' });
    expect(changes).toEqual({ status: { from: 'open', to: 'closed' } });
  });

  it('treats a missing row as every non-null field being new', () => {
    expect(diffDetails(null, { trail_id: 't1', status: 'open', status_hint: null })).toEqual({ status: { from: null, to: 'open' } });
  });
});

describe('applyDetails', () => {
  it('dry run reports the field diff without writing anything', async () => {
    const { client, writes, db } = fakeSupabase({ trail_details: [existingRow] });
    const entry = await applyDetails(client, scraped, { dryRun: true });
    expect(entry.action).toBe('update');
    expect(Object.keys(entry.changes)).toEqual(['rules', 'trail_description']);
    expect(writes).toEqual([]);
    expect(db.trail_details[0].trail_description).toBe('Alt');
  });

  it('writes only changed fields and succeeds even though the input carries an evidence key', async () => {
    const { client, db } = fakeSupabase({ trail_details: [existingRow] });
    await applyDetails(client, scraped, { dryRun: false });
    expect(db.trail_details[0]).toMatchObject({ trail_description: 'Neu', rules: ['Helm tragen', 'Nicht bei Nässe'] });
  });

  it('creates a row for a spot without trail_details', async () => {
    const { client, db } = fakeSupabase();
    const entry = await applyDetails(client, scraped, { dryRun: false });
    expect(entry.action).toBe('create');
    expect(db.trail_details).toHaveLength(1);
  });

  it('skips trailcrew-managed spots without reading or writing details', async () => {
    const { client, writes } = fakeSupabase({ trail_details: [existingRow], trailcrew_spots: [{ spot_id: 't1', user_id: 'u' }] });
    expect((await applyDetails(client, scraped, { dryRun: false })).action).toBe('skipped_trailcrew');
    expect(writes).toEqual([]);
  });

  it('does not write when nothing changed', async () => {
    const { client, writes } = fakeSupabase({ trail_details: [existingRow] });
    const same = { ...existingRow, name: 'Testtrail' };
    expect((await applyDetails(client, same, { dryRun: false })).action).toBe('unchanged');
    expect(writes).toEqual([]);
  });
});

describe('revertEntry', () => {
  it('restores the previous values of an updated spot and removes parking added by the run', async () => {
    const { client, db } = fakeSupabase({ trail_details: [existingRow] });
    const entry = await applyDetails(client, scraped, { dryRun: false });
    entry.parking_ids.push(await client.insertParking({ spot_id: 't1', name: 'P1', lat: 1, lng: 2 }));

    const result = await revertEntry(client, JSON.parse(JSON.stringify(entry)));
    expect(result.conflicts).toEqual([]);
    expect(db.trail_details[0]).toEqual(existingRow);
    expect(db.parking).toEqual([]);
  });

  it('deletes a row the run created', async () => {
    const { client, db } = fakeSupabase();
    const entry = await applyDetails(client, scraped, { dryRun: false });
    await revertEntry(client, entry);
    expect(db.trail_details).toEqual([]);
  });

  it('refuses to clobber a field edited after the import unless forced', async () => {
    const { client, db } = fakeSupabase({ trail_details: [existingRow] });
    const entry = await applyDetails(client, scraped, { dryRun: false });
    db.trail_details[0].trail_description = 'Von Trailcrew korrigiert';

    const skipped = await revertEntry(client, entry);
    expect(skipped.skipped).toBe(true);
    expect(skipped.conflicts[0]).toMatch(/^trail_description/);
    expect(db.trail_details[0].trail_description).toBe('Von Trailcrew korrigiert');

    await revertEntry(client, entry, { force: true });
    expect(db.trail_details[0].trail_description).toBe('Alt');
  });

  it('dry run lists the steps without writing', async () => {
    const { client, db } = fakeSupabase({ trail_details: [existingRow] });
    const entry = await applyDetails(client, scraped, { dryRun: false });
    const result = await revertEntry(client, entry, { dryRun: true });
    expect(result.steps).toEqual(['restore rules, trail_description']);
    expect(db.trail_details[0].trail_description).toBe('Neu');
  });
});

describe('formatReview', () => {
  it('lists from/to per changed field and new parking', () => {
    const md = formatReview([
      { trail_id: 't1', name: 'Testtrail', action: 'update', changes: { status: { from: 'open', to: 'closed' } }, parking: ['P Nord'] },
      { trail_id: 't2', name: 'Other', action: 'unchanged' },
    ], { title: 'Dry run' });
    expect(md).toContain('update: 1 · unchanged: 1');
    expect(md).toContain('## Testtrail — update');
    expect(md).toContain('  - from: "open"');
    expect(md).toContain('**parking +** P Nord');
    expect(md).not.toContain('## Other');
  });
});
