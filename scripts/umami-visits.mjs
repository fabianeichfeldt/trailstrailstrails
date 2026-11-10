// Raw per-visit engagement for the Umami reports: engagement is defined here, not by Umami's aggregate counts.

export const ENGAGEMENT_RULES = {
  version: 2,
  countedActions: ['map_pin_open', 'search', 'filter_toggle', 'locate_me', 'item_select', 'photo_open', 'share', 'parking_select', 'like', 'spot_open'],
  // spot_open right after one of these is the same user action.
  mergeOpenAfter: ['map_pin_open', 'search'],
  mergeWindowMs: 5000,
  minActionsEngaged: 2,
};
export const ENGAGEMENT_NOTE = 'Engagement v2: computed from raw events (see scripts/umami-visits.mjs).';

const PAGE_SIZE = 100;
const unwrap = raw => (Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []);

async function getJson(fetchFn, url, token) {
  const res = await fetchFn(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Umami request failed (${res.status}) ${new URL(url).pathname}`);
  return res.json();
}

// Runs fn over items with at most `limit` in flight; results keep input order.
async function mapLimited(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

const mostFrequent = values => {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = null;
  for (const [v, c] of counts) if (best == null || c > best[1]) best = [v, c];
  return best ? best[0] : null;
};

export function groupIntoVisits(activities) {
  const byVisit = new Map();
  for (const a of activities) {
    if (String(a.urlPath ?? '').startsWith('/embed/')) continue;
    const key = a.visitId ?? `${a.sessionId}:nov`;
    if (!byVisit.has(key)) byVisit.set(key, { visitId: key, sessionId: a.sessionId, tags: [], events: [] });
    const v = byVisit.get(key);
    v.tags.push(a.tag);
    v.events.push({
      type: Number(a.eventType) === 2 ? 'event' : 'pageview',
      name: Number(a.eventType) === 2 ? a.eventName ?? null : null,
      at: Date.parse(a.createdAt),
      url: a.urlPath ?? null,
    });
  }
  return [...byVisit.values()].map(({ tags, events, ...v }) => {
    events.sort((a, b) => a.at - b.at);
    return { ...v, tag: mostFrequent(tags), startedAt: events[0].at, endedAt: events[events.length - 1].at, events };
  }).sort((a, b) => a.startedAt - b.startedAt);
}

export async function fetchVisits({ fetch: fetchFn, baseUrl, token, websiteId, startAt, endAt, concurrency = 4 }) {
  const base = `${baseUrl}/api/websites/${websiteId}`;
  const sessions = [];
  for (let page = 1; ; page++) {
    const q = new URLSearchParams({ startAt: String(startAt), endAt: String(endAt), page: String(page), pageSize: String(PAGE_SIZE) });
    const raw = await getJson(fetchFn, `${base}/sessions?${q}`, token);
    const rows = unwrap(raw);
    sessions.push(...rows);
    if (!rows.length || page * PAGE_SIZE >= Number(raw?.count ?? 0)) break;
  }
  const q = new URLSearchParams({ startAt: String(startAt), endAt: String(endAt) });
  const perSession = await mapLimited(sessions, concurrency, async s => {
    const acts = unwrap(await getJson(fetchFn, `${base}/sessions/${s.id}/activity?${q}`, token));
    return acts.map(a => ({ ...a, sessionId: a.sessionId ?? s.id }));
  });
  return groupIntoVisits(perSession.flat());
}

export function countActions(visit, rules = ENGAGEMENT_RULES) {
  let count = 0;
  let lastTrigger = -Infinity;
  for (const e of visit.events) {
    if (e.type !== 'event' || !rules.countedActions.includes(e.name)) continue;
    if (e.name === 'spot_open' && e.at - lastTrigger <= rules.mergeWindowMs) continue;
    if (rules.mergeOpenAfter.includes(e.name)) lastTrigger = e.at;
    count++;
  }
  return count;
}

const median = xs => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const ratio = (a, b) => (b > 0 ? a / b : 0);

export function summariseVisits(visits, rules = ENGAGEMENT_RULES) {
  const rows = visits.map(v => ({
    actions: countActions(v, rules),
    pageviews: v.events.filter(e => e.type === 'pageview').length,
    spotViews: v.events.filter(e => e.type === 'event' && (e.name === 'spot_open' || e.name === 'spot_land')).length,
    seconds: (v.endedAt - v.startedAt) / 1000,
  }));
  const n = rows.length;
  const engaged = rows.filter(r => r.actions >= rules.minActionsEngaged).length;
  const bounced = rows.filter(r => r.pageviews === 1 && r.actions === 0).length;
  const times = rows.map(r => r.seconds);
  return {
    visits: n,
    engagedVisits: engaged,
    engagedRate: ratio(engaged, n),
    actionsPerVisit: ratio(rows.reduce((a, r) => a + r.actions, 0), n),
    spotViewsPerVisit: ratio(rows.reduce((a, r) => a + r.spotViews, 0), n),
    bounceRate: ratio(bounced, n),
    activeTimeMedian: median(times),
    activeTimeMean: ratio(times.reduce((a, b) => a + b, 0), n),
  };
}

// Visits tagged "<prefix><variant>" -> { variant: Visit[] }.
export function groupByTag(visits, prefix) {
  const out = {};
  for (const v of visits) {
    if (v.tag == null || !v.tag.startsWith(prefix)) continue;
    (out[v.tag.slice(prefix.length)] ??= []).push(v);
  }
  return out;
}
