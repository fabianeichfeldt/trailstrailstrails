// Pure helpers for `npm run experiment:report` (Umami A/B readout). No I/O except the injected fetch.

export const EVENT_NAMES = ['engaged', 'spot_open', 'item_select', 'search', 'filter_toggle', 'locate_me', 'photo_open', 'share', 'parking_select', 'map_pin_open', 'like'];

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
// Umami v1/v2 returns { visits: { value, prev } }, newer versions flat numbers.
const pick = v => (v && typeof v === 'object' ? num(v.value) : num(v));

export function normaliseStats(raw) {
  const r = raw ?? {};
  return {
    visits: pick(r.visits),
    visitors: pick(r.visitors),
    pageviews: pick(r.pageviews),
    bounces: pick(r.bounces),
    totaltime: pick(r.totaltime),
  };
}

export function normaliseMetrics(raw) {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
  const out = {};
  for (const row of rows) {
    const name = row?.x ?? row?.name ?? row?.event;
    if (name == null) continue;
    out[name] = (out[name] ?? 0) + num(row.y ?? row.value ?? row.count);
  }
  return out;
}

const ratio = (a, b) => (b > 0 ? a / b : 0);

export function computeMetrics(stats, events) {
  const { visits } = stats;
  const engagedCount = Math.min(events.engaged ?? 0, visits);
  const totalEvents = Object.values(events).reduce((a, b) => a + b, 0);
  return {
    visits,
    engagedCount,
    avgVisitSeconds: ratio(stats.totaltime, visits),
    bounceRate: Math.min(1, ratio(stats.bounces, visits)),
    engagedRate: Math.min(1, ratio(events.engaged ?? 0, visits)),
    spotOpenPerVisit: ratio(events.spot_open ?? 0, visits),
    eventsPerVisit: ratio(totalEvents, visits),
  };
}

// Abramowitz-Stegun 7.1.26 erf, max error ~1.5e-7.
function normalCdf(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = ((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592;
  const erf = 1 - poly * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

// Control = (x1, n1), treatment = (x2, n2). Pooled SE for the test, unpooled for the CI.
export function twoProportionZ(x1, n1, x2, n2) {
  const p1 = ratio(x1, n1);
  const p2 = ratio(x2, n2);
  const diff = p2 - p1;
  const pooled = ratio(x1 + x2, n1 + n2);
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const z = sePooled > 0 ? diff / sePooled : 0;
  const pValue = sePooled > 0 ? 2 * (1 - normalCdf(Math.abs(z))) : 1;
  const seDiff = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  return {
    p1, p2, diff, z, pValue,
    lift: p1 > 0 ? diff / p1 : null,
    ci95: [diff - 1.96 * seDiff, diff + 1.96 * seDiff],
  };
}

export function verdict(control, variant, minVisits, alpha = 0.05) {
  if (control.visits < minVisits || variant.visits < minVisits) return 'need_more_data';
  const t = twoProportionZ(control.engagedCount, control.visits, variant.engagedCount, variant.visits);
  if (t.pValue >= alpha) return 'no_difference';
  return t.diff > 0 ? 'winner' : 'loser';
}

export function compareVariants(variantMetrics, minVisits) {
  const [control, ...rest] = variantMetrics;
  return rest.map(v => ({
    control: control.variant,
    variant: v.variant,
    ...twoProportionZ(control.engagedCount, control.visits, v.engagedCount, v.visits),
    verdict: verdict(control, v, minVisits),
  }));
}

const dayMs = 86400000;
export function parseDate(s, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(s ?? '')) throw new Error(`Invalid date "${s}", expected YYYY-MM-DD`);
  const t = Date.parse(s.length === 10 ? `${s}T00:00:00Z` : s);
  if (Number.isNaN(t)) throw new Error(`Invalid date "${s}"`);
  return endOfDay && s.length === 10 ? t + dayMs - 1 : t;
}

async function getJson(fetchFn, url, token) {
  const res = await fetchFn(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Umami request failed (${res.status}) ${new URL(url).pathname}`);
  return res.json();
}

export async function login(fetchFn, baseUrl, username, password) {
  const res = await fetchFn(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`Umami login failed (${res.status})`);
  const { token } = await res.json();
  if (!token) throw new Error('Umami login returned no token');
  return token;
}

async function fetchSlice(fetchFn, base, token, startAt, endAt, tag) {
  const q = new URLSearchParams({ startAt: String(startAt), endAt: String(endAt) });
  if (tag) q.set('tag', tag);
  const stats = normaliseStats(await getJson(fetchFn, `${base}/stats?${q}`, token));
  q.set('type', 'event');
  const events = normaliseMetrics(await getJson(fetchFn, `${base}/metrics?${q}`, token));
  return { stats, events, ...computeMetrics(stats, events) };
}

export async function collectReport({ fetch: fetchFn, baseUrl, websiteId, username, password, experiment, startAt, endAt }) {
  const token = await login(fetchFn, baseUrl, username, password);
  const base = `${baseUrl}/api/websites/${websiteId}`;
  const variants = [];
  for (const variant of experiment.variants) {
    const slice = await fetchSlice(fetchFn, base, token, startAt, endAt, `${experiment.id}:${variant}`);
    variants.push({ variant, ...slice });
  }
  const all = await fetchSlice(fetchFn, base, token, startAt, endAt, null);
  return {
    experiment: { id: experiment.id, hypothesis: experiment.hypothesis, primaryMetric: experiment.primaryMetric, minVisitsPerVariant: experiment.minVisitsPerVariant },
    window: { startAt, endAt },
    variants,
    allTraffic: { variant: 'all traffic', ...all },
    comparisons: compareVariants(variants, experiment.minVisitsPerVariant),
  };
}

const pct = v => `${(v * 100).toFixed(1)}%`;
const f2 = v => v.toFixed(2);

export function renderMarkdown(report) {
  const { experiment: e, window: w } = report;
  const day = ms => new Date(ms).toISOString().slice(0, 10);
  const rows = [...report.variants, report.allTraffic].map(v =>
    `| ${v.variant} | ${v.visits} | ${Math.round(v.avgVisitSeconds)} | ${pct(v.bounceRate)} | ${pct(v.engagedRate)} | ${f2(v.spotOpenPerVisit)} | ${f2(v.eventsPerVisit)} |`);
  const lines = [
    `# Experiment ${e.id}`,
    '',
    `Hypothesis: ${e.hypothesis}`,
    `Window: ${day(w.startAt)} to ${day(w.endAt)} | primary metric: ${e.primaryMetric} | min visits per variant: ${e.minVisitsPerVariant}`,
    '',
    '| Variant | Visits | Avg visit (s) | Bounce rate | Engaged rate | spot_open/visit | Events/visit |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Comparisons (vs control)',
    '',
  ];
  for (const c of report.comparisons) {
    const lift = c.lift == null ? 'n/a' : `${c.lift >= 0 ? '+' : ''}${(c.lift * 100).toFixed(1)}%`;
    lines.push(`- ${c.variant} vs ${c.control}: **${c.verdict}** (engaged ${pct(c.p2)} vs ${pct(c.p1)}, lift ${lift}, diff ${(c.diff * 100).toFixed(1)} pp, 95% CI [${(c.ci95[0] * 100).toFixed(1)}, ${(c.ci95[1] * 100).toFixed(1)}] pp, z=${f2(c.z)}, p=${c.pValue.toFixed(4)})`);
  }
  return lines.join('\n') + '\n';
}
