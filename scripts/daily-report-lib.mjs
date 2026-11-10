// Pure helpers for `npm run daily:report` (Umami daily readout). No I/O except the injected fetch.
import { computeMetrics, login, normaliseMetrics, normaliseStats } from './experiment-report-lib.mjs';
import { ENGAGEMENT_NOTE, fetchVisits, groupByTag, summariseVisits } from './umami-visits.mjs';

export const TZ = 'Europe/Berlin';
const DAY = 86400000;
export const RETENTION_CAVEAT = 'Lower bound: Umami re-identifies by IP + browser with a monthly salt; new mobile IPs and returns in a new month count as new.';

const clockFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

export const isIsoDay = s => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
export const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from, to) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY;

// Berlin wall-clock of an instant, expressed as if it were UTC.
function wallAsUtc(ms) {
  const p = Object.fromEntries(clockFmt.formatToParts(new Date(ms)).map(({ type, value }) => [type, value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
}
const offsetAt = ms => wallAsUtc(ms) - Math.floor(ms / 1000) * 1000;

export function berlinMidnight(day) {
  const wall = Date.parse(`${day}T00:00:00Z`);
  return wall - offsetAt(wall - offsetAt(wall));
}

// Inclusive [startAt, endAt] in ms, matching Umami's startAt/endAt.
export function dayWindow(day) {
  return { startAt: berlinMidnight(day), endAt: berlinMidnight(addDays(day, 1)) - 1 };
}

export function yesterdayInBerlin(now = new Date()) {
  return addDays(new Date(wallAsUtc(now.getTime())).toISOString().slice(0, 10), -1);
}

// Change as a fraction (0.2 = +20%) for kind 'pct', or a fraction-point difference for kind 'pp'.
export function changeOf(current, baseline, kind) {
  if (current == null || baseline == null) return null;
  if (kind === 'pp') return current - baseline;
  if (baseline === 0) return current === 0 ? 0 : null;
  return (current - baseline) / baseline;
}

export function formatChange(c, kind) {
  if (c == null) return 'n/a';
  const sign = c >= 0 ? '+' : '';
  return kind === 'pp' ? `${sign}${(c * 100).toFixed(1)} pp` : `${sign}${(c * 100).toFixed(1)}%`;
}

const sum = (rows, key) => rows.reduce((a, r) => a + Number(r[key] ?? 0), 0);

// Weighted over cohorts: total returned / total cohort visitors at that day offset.
export function retentionSummary(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const at = d => {
    const hit = list.filter(r => Number(r.day) === d);
    const visitors = sum(hit, 'visitors');
    const returned = sum(hit, 'returnVisitors');
    return { cohorts: hit.length, visitors, returned, rate: visitors > 0 ? returned / visitors : null };
  };
  return { day1: at(1), day7: at(7) };
}

export function countBy(rows, keyOf) {
  const counts = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (k == null) continue;
    counts.set(k, (counts.get(k) ?? 0) + Number(r.y ?? 0));
  }
  return [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export const normaliseSpotUrl = url => String(url ?? '').replace(/\/+$/, '');

// /embed/* pageviews are iframe loads (stopped 2026-11-10), not visits; '/' must survive the slash strip.
export const topPages = (rows, n = 5) => countBy(rows, r => {
  if (!r.x || r.x.startsWith('/embed/')) return null;
  return normaliseSpotUrl(r.x) || '/';
}).slice(0, n);

export function topSpots(rows, n = 5) {
  return countBy(rows, r => {
    const u = normaliseSpotUrl(r.x);
    return u.startsWith('/trails/') && u.length > '/trails/'.length ? u : null;
  }).slice(0, n);
}

export const referrerLabel = x => (x == null || String(x).trim() === '' ? 'direct' : x);
export const topReferrers = (rows, n = 5) => countBy(rows, r => referrerLabel(r.x)).slice(0, n);

export function deviceShares(rows) {
  const list = countBy(rows, r => r.x || 'unknown');
  const total = sum(list, 'count');
  return list.map(({ key, count }) => ({ key, count, share: total > 0 ? count / total : 0 }));
}

// `visitsByVariant` is { variant: visits }; the lead arm is the one with the fewest visits.
export function experimentProgress({ variants, visitsByVariant, minVisitsPerVariant, daysSoFar }) {
  const visits = variants.map(v => ({ variant: v, visits: visitsByVariant[v] ?? 0 }));
  const minVisits = visits.length ? Math.min(...visits.map(v => v.visits)) : 0;
  const ready = visits.every(v => v.visits >= minVisitsPerVariant);
  const perDay = daysSoFar > 0 ? minVisits / daysSoFar : 0;
  let daysLeft = null;
  if (ready) daysLeft = 0;
  else if (perDay > 0) daysLeft = Math.ceil((minVisitsPerVariant - minVisits) / perDay);
  return { variants: visits, minVisits, ready, perDay, daysLeft };
}

// `tags` is normaliseMetrics() output for metrics?type=tag; tags look like "<experimentId>:<variant>".
export function tagVisits(tags, experimentId, variants) {
  return Object.fromEntries(variants.map(v => [v, tags[`${experimentId}:${v}`] ?? 0]));
}

const OVERVIEW = [
  ['Visits', 'visits', 'count', 'pct'],
  ['Visitors', 'visitors', 'count', 'pct'],
  ['Engaged rate', 'engagedRate', 'rate', 'pp'],
  ['Actions per visit', 'actionsPerVisit', 'ratio', 'pct'],
  ['Active time median (s)', 'activeTimeMedian', 'seconds', 'pct'],
  ['Bounce rate', 'bounceRate', 'rate', 'pp'],
];

// `day` and `base` carry visits/visitors (from /stats) plus summariseVisits() fields.
export function buildOverview(day, base) {
  // Seconds are shown rounded; compare what is shown, or 0.4 s vs 0.3 s reads as "0 → 0, +33%".
  const shown = (v, unit) => (unit === 'seconds' && v != null ? Math.round(v) : v);
  return OVERVIEW.map(([label, key, unit, kind]) => ({
    label, unit, kind, day: day[key], base: base[key], change: changeOf(shown(day[key], unit), shown(base[key], unit), kind),
  }));
}

// Sums daily {stats, events} slices into one baseline. Counts are per-day averages; rates use the summed totals.
export function aggregateBaseline(days) {
  const n = days.length || 1;
  const total = key => days.reduce((a, d) => a + (d.stats[key] ?? 0), 0);
  const events = {};
  for (const d of days) for (const [k, v] of Object.entries(d.events)) events[k] = (events[k] ?? 0) + v;
  const stats = { visits: total('visits'), visitors: total('visitors'), pageviews: total('pageviews'), bounces: total('bounces'), totaltime: total('totaltime') };
  return { ...computeMetrics(stats, events), visits: stats.visits / n, visitors: stats.visitors / n };
}

export function visitsPerVisitor(day) {
  return day.visitors > 0 ? day.visits / day.visitors : null;
}

export async function collectDailyReport({ fetch: fetchFn, baseUrl, websiteId, username, password, day, registry }) {
  const token = await login(fetchFn, baseUrl, username, password);
  const base = `${baseUrl}/api/websites/${websiteId}`;
  const call = async (url, init = {}) => {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}) };
    const res = await fetchFn(url, { ...init, headers });
    if (!res.ok) throw new Error(`Umami request failed (${res.status}) ${new URL(url).pathname}`);
    return res.json();
  };
  const q = w => new URLSearchParams({ startAt: String(w.startAt), endAt: String(w.endAt) });
  const stats = async w => normaliseStats(await call(`${base}/stats?${q(w)}`));
  const metrics = async (w, type) => call(`${base}/metrics?${new URLSearchParams({ ...Object.fromEntries(q(w)), type })}`);
  const slice = async w => {
    const s = await stats(w);
    return { stats: s, events: {}, ...computeMetrics(s, {}) };
  };

  const dw = dayWindow(day);
  const baselineDays = [];
  for (let i = 7; i >= 1; i--) baselineDays.push(dayWindow(addDays(day, -i)));

  const exp = registry?.experiments?.find(e => e.id === registry.active);
  const expRunning = exp && exp.startedAt && day >= exp.startedAt;
  const baselineStart = baselineDays[0].startAt;
  // One raw fetch covers the day, the baseline and (if older) the experiment start.
  const visitsFrom = expRunning ? Math.min(baselineStart, berlinMidnight(exp.startedAt)) : baselineStart;

  const [dayRaw, baselineSlices, allVisits, urlRows, referrerRows, deviceRows, retentionRaw] = await Promise.all([
    slice(dw),
    Promise.all(baselineDays.map(slice)),
    fetchVisits({ fetch: fetchFn, baseUrl, token, websiteId, startAt: visitsFrom, endAt: dw.endAt }),
    metrics(dw, 'url'),
    metrics(dw, 'referrer'),
    metrics(dw, 'device'),
    call(`${baseUrl}/api/reports/retention`, {
      method: 'POST',
      body: JSON.stringify({
        websiteId,
        dateRange: { startDate: new Date(dayWindow(addDays(day, -27)).startAt).toISOString(), endDate: new Date(dw.endAt).toISOString() },
        timezone: TZ,
      }),
    }),
  ]);

  const within = (w, vs) => vs.filter(v => v.startedAt >= w.startAt && v.startedAt <= w.endAt);
  const { visits: _dv, ...dayEng } = summariseVisits(within(dw, allVisits));
  const { visits: _bv, ...baseEng } = summariseVisits(within({ startAt: baselineStart, endAt: baselineDays[6].endAt }, allVisits));
  const dayMetrics = { ...dayRaw, visitors: dayRaw.stats.visitors, ...dayEng };
  const baseMetrics = { ...aggregateBaseline(baselineSlices), ...baseEng };

  let experiment = null;
  if (exp) {
    if (!exp.startedAt || day < exp.startedAt) {
      experiment = { id: exp.id, startedAt: exp.startedAt ?? null, notStarted: true };
    } else {
      const groups = groupByTag(within({ startAt: berlinMidnight(exp.startedAt), endAt: dw.endAt }, allVisits), `${exp.id}:`);
      const visitsByVariant = Object.fromEntries(exp.variants.map(v => [v, (groups[v] ?? []).length]));
      experiment = {
        id: exp.id,
        hypothesis: exp.hypothesis,
        startedAt: exp.startedAt,
        minVisitsPerVariant: exp.minVisitsPerVariant,
        ...experimentProgress({
          variants: exp.variants,
          visitsByVariant,
          minVisitsPerVariant: exp.minVisitsPerVariant,
          daysSoFar: daysBetween(exp.startedAt, day) + 1,
        }),
      };
    }
  }

  return {
    day,
    window: { day: dw, baseline: { startAt: baselineDays[0].startAt, endAt: baselineDays[6].endAt } },
    overview: buildOverview(dayMetrics, baseMetrics),
    visitsPerVisitor: visitsPerVisitor(dayMetrics),
    retention: retentionSummary(retentionRaw),
    topPages: topPages(urlRows),
    topSpots: topSpots(urlRows),
    referrers: topReferrers(referrerRows),
    devices: deviceShares(deviceRows),
    experiment,
  };
}

const pct1 = v => (v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
function fmt(v, unit) {
  if (v == null) return 'n/a';
  if (unit === 'rate') return pct1(v);
  if (unit === 'seconds') return String(Math.round(v));
  if (unit === 'ratio') return v.toFixed(2);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

const list = (rows, label) => (rows.length
  ? rows.map((r, i) => `${i + 1}. ${label(r)}`).join('\n')
  : '_none_');

export function renderDailyMarkdown(report) {
  const day = report.day;
  const lines = [
    `# Trailradar daily report: ${day}`,
    '',
    `Day ${day} (Europe/Berlin) | baseline: 7 days before, ${new Date(report.window.baseline.startAt).toISOString().slice(0, 10)} to ${addDays(day, -1)}`,
    '',
    '## Overview',
    '',
    ENGAGEMENT_NOTE,
    '',
    '| Metric | Day | 7-day avg | Change |',
    '|---|---|---|---|',
    ...report.overview.map(r => `| ${r.label} | ${fmt(r.day, r.unit)} | ${fmt(r.base, r.unit)} | ${formatChange(r.change, r.kind)} |`),
    '',
    '## Returning visitors (last 28 days)',
    '',
    `- Day-1 return: ${pct1(report.retention.day1.rate)} (${report.retention.day1.returned} of ${report.retention.day1.visitors} visitors, ${report.retention.day1.cohorts} cohorts)`,
    `- Day-7 return: ${pct1(report.retention.day7.rate)} (${report.retention.day7.returned} of ${report.retention.day7.visitors} visitors, ${report.retention.day7.cohorts} cohorts)`,
    `- Visits per visitor (day): ${report.visitsPerVisitor == null ? 'n/a' : report.visitsPerVisitor.toFixed(2)}`,
    '',
    `_${RETENTION_CAVEAT}_`,
    '',
    '## Top 5 pages',
    '',
    list(report.topPages, r => `${r.key}: ${r.count}`),
    '',
    '## Top 5 spots',
    '',
    list(report.topSpots, r => `${r.key}: ${r.count}`),
    '',
    '## Sources',
    '',
    '### Referrers',
    '',
    list(report.referrers, r => `${r.key}: ${r.count}`),
    '',
    '### Devices',
    '',
    report.devices.length ? report.devices.map(d => `- ${d.key}: ${pct1(d.share)}`).join('\n') : '_none_',
    '',
    '## Experiment',
    '',
  ];
  const e = report.experiment;
  if (!e) lines.push('No active experiment.');
  else if (e.notStarted) lines.push(`${e.id} starts ${e.startedAt ?? 'at an unknown date'}; nothing to read yet.`);
  else {
    lines.push(`${e.id} since ${e.startedAt} | min visits per variant: ${e.minVisitsPerVariant}`);
    lines.push('');
    lines.push('| Variant | Visits |', '|---|---|', ...e.variants.map(v => `| ${v.variant} | ${v.visits} |`));
    lines.push('');
    if (e.ready) lines.push('Ready for /experiment-cycle: every arm reached the minimum.');
    else if (e.daysLeft == null) lines.push('Days left: n/a (no visits yet).');
    else lines.push(`Days left ≈ ${e.daysLeft} (at ${e.perDay.toFixed(1)} min-arm visits/day so far).`);
  }
  return lines.join('\n') + '\n';
}
