// Pure-ish core of the trail_details import: diffing, the per-run change log and revert.
// All HTTP goes through createClient() so tests can swap `fetch` at the network boundary.

// Columns the scraper may write. last_update is DB-managed; anything else in the input (name, evidence, ...) is dropped.
const DETAIL_COLUMNS = [
  'trail_id', 'status', 'status_hint', 'status_until', 'opening_hours_text', 'rules', 'trail_description',
  'affected_trail_ids', 'seasonal_from', 'seasonal_to',
  'rain_policy', 'rain_closed_hours', 'rain_window_from', 'rain_window_to',
  'night_policy', 'night_before_dusk_min', 'night_after_dawn_min',
  'access_type', 'donation_url',
];

function pickDetailFields(record) {
  const payload = {};
  const dropped = [];
  for (const [key, value] of Object.entries(record)) {
    if (DETAIL_COLUMNS.includes(key)) payload[key] = value;
    else dropped.push(key);
  }
  return { payload, dropped };
}

function canonical(value) {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameValue(a, b) {
  return canonical(a) === canonical(b);
}

// { field: { from, to } } for every payload field that differs from the stored row (null row = new spot).
function diffDetails(before, payload) {
  const changes = {};
  for (const [key, to] of Object.entries(payload)) {
    if (key === 'trail_id') continue;
    const from = before ? before[key] ?? null : null;
    if (!sameValue(from, to)) changes[key] = { from, to: to ?? null };
  }
  return changes;
}

function createClient({ url, key, fetch: fetchImpl = fetch }) {
  const headers = (extra = {}) => ({
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  });
  const rest = `${url}/rest/v1`;
  const eq = value => `eq.${encodeURIComponent(value)}`;

  async function request(path, init, what) {
    const res = await fetchImpl(`${rest}/${path}`, { ...init, headers: headers(init?.headers) });
    if (!res.ok) throw new Error(`${what} failed: ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  return {
    async hasTrailcrew(spotId) {
      const rows = await request(`trailcrew_spots?select=user_id&spot_id=${eq(spotId)}&limit=1`, {}, 'trailcrew_spots lookup');
      return rows.length > 0;
    },
    async getDetails(trailId) {
      const rows = await request(`trail_details?select=*&trail_id=${eq(trailId)}`, {}, 'trail_details read');
      return rows[0] ?? null;
    },
    async upsertDetails(payload) {
      await request('trail_details', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(payload),
      }, 'trail_details upsert');
    },
    async patchDetails(trailId, fields) {
      await request(`trail_details?trail_id=${eq(trailId)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(fields),
      }, 'trail_details patch');
    },
    async deleteDetails(trailId) {
      await request(`trail_details?trail_id=${eq(trailId)}`, { method: 'DELETE' }, 'trail_details delete');
    },
    async parkingNames(spotId) {
      const rows = await request(`parking?select=name&spot_id=${eq(spotId)}`, {}, 'parking read');
      return new Set(rows.map(r => r.name));
    },
    async insertParking(row) {
      const rows = await request('parking', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(row),
      }, 'parking insert');
      return rows[0].id;
    },
    async getParking(id) {
      const rows = await request(`parking?select=*&id=${eq(id)}`, {}, 'parking read');
      return rows[0] ?? null;
    },
    async deleteParking(id) {
      await request(`parking?id=${eq(id)}`, { method: 'DELETE' }, 'parking delete');
    },
  };
}

// Plans (and unless dryRun, applies) one spot's trail_details. The returned entry is the change-log line revert needs.
async function applyDetails(client, record, { dryRun }) {
  const { payload } = pickDetailFields(record);
  const entry = { trail_id: record.trail_id, name: record.name ?? null };

  if (await client.hasTrailcrew(record.trail_id)) return { ...entry, action: 'skipped_trailcrew' };

  const before = await client.getDetails(record.trail_id);
  const changes = diffDetails(before, payload);
  if (Object.keys(changes).length === 0) return { ...entry, action: 'unchanged' };

  const action = before ? 'update' : 'create';
  if (!dryRun) {
    // Only the changed fields are written, so later SpotManager edits to other fields are never clobbered.
    const fields = Object.fromEntries(Object.entries(changes).map(([k, c]) => [k, c.to]));
    if (before) await client.patchDetails(record.trail_id, fields);
    else await client.upsertDetails({ trail_id: record.trail_id, ...fields });
  }
  return { ...entry, action, changes, parking_ids: [] };
}

// Undoes one change-log entry. Fields edited again since the import are conflicts and block the revert unless force.
async function revertEntry(client, entry, { dryRun = false, force = false } = {}) {
  const result = { trail_id: entry.trail_id, name: entry.name, steps: [], conflicts: [] };
  if (entry.action !== 'create' && entry.action !== 'update') return result;

  const current = await client.getDetails(entry.trail_id);
  if (!current) {
    result.conflicts.push('trail_details row no longer exists');
  } else {
    for (const [key, change] of Object.entries(entry.changes)) {
      if (!sameValue(current[key], change.to)) {
        result.conflicts.push(`${key}: now ${canonical(current[key])}, import wrote ${canonical(change.to)}`);
      }
    }
  }

  const parkingIds = [];
  for (const id of entry.parking_ids ?? []) {
    if (await client.getParking(id)) parkingIds.push(id);
  }

  if (result.conflicts.length > 0 && !force) {
    result.skipped = true;
    return result;
  }

  if (current) {
    if (entry.action === 'create') {
      result.steps.push('delete trail_details row');
      if (!dryRun) await client.deleteDetails(entry.trail_id);
    } else {
      const fields = Object.fromEntries(Object.entries(entry.changes).map(([k, c]) => [k, c.from]));
      result.steps.push(`restore ${Object.keys(fields).join(', ')}`);
      if (!dryRun) await client.patchDetails(entry.trail_id, fields);
    }
  }
  for (const id of parkingIds) {
    result.steps.push(`delete parking ${id}`);
    if (!dryRun) await client.deleteParking(id);
  }
  return result;
}

function formatValue(value) {
  return value === null || value === undefined ? '∅' : canonical(value);
}

// Markdown review file for a dry run: one section per spot that would change.
function formatReview(entries, { title }) {
  const counts = {};
  for (const e of entries) counts[e.action] = (counts[e.action] ?? 0) + 1;
  const lines = [`# ${title}`, '', Object.entries(counts).map(([a, n]) => `${a}: ${n}`).join(' · '), ''];

  for (const e of entries) {
    if (e.action !== 'create' && e.action !== 'update' && !(e.parking?.length)) continue;
    lines.push(`## ${e.name ?? '(no name)'} — ${e.action}`, '', `\`${e.trail_id}\``, '');
    for (const [key, c] of Object.entries(e.changes ?? {})) {
      lines.push(`- **${key}**`, `  - from: ${formatValue(c.from)}`, `  - to:   ${formatValue(c.to)}`);
    }
    for (const p of e.parking ?? []) lines.push(`- **parking +** ${p}`);
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = {
  DETAIL_COLUMNS, pickDetailFields, diffDetails, sameValue,
  createClient, applyDetails, revertEntry, formatReview,
};
