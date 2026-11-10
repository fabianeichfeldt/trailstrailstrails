import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain .mjs
import * as lib from './daily-report-lib.mjs';

const { aggregateBaseline, berlinMidnight, buildOverview, changeOf, collectDailyReport, dayWindow, deviceShares, experimentProgress, formatChange, renderDailyMarkdown, retentionSummary, tagVisits, topPages, topReferrers, topSpots, yesterdayInBerlin } = lib;

const retentionRows = [
  { date: '2026-11-07 00:00:00', day: 0, visitors: 71, returnVisitors: 71, percentage: 100 },
  { date: '2026-11-07 00:00:00', day: 1, visitors: 71, returnVisitors: 3, percentage: 4.2 },
];

describe('Berlin day windows', () => {
  it('spans local midnight to midnight in CET (DST-free November date)', () => {
    const w = dayWindow('2026-11-10');
    expect(w.startAt).toBe(Date.parse('2026-11-10T00:00:00+01:00'));
    expect(w.endAt).toBe(Date.parse('2026-11-11T00:00:00+01:00') - 1);
  });

  it('uses CEST for summer dates', () => {
    expect(berlinMidnight('2026-07-01')).toBe(Date.parse('2026-07-01T00:00:00+02:00'));
  });

  it('picks yesterday in Berlin, not UTC', () => {
    // 2026-11-09T23:30Z is already 2026-11-10 00:30 in Berlin, so "yesterday" is 2026-11-09.
    expect(yesterdayInBerlin(new Date('2026-11-09T23:30:00Z'))).toBe('2026-11-09');
    // 2026-11-09T22:30Z is still 2026-11-09 23:30 in Berlin, so "yesterday" is 2026-11-08.
    expect(yesterdayInBerlin(new Date('2026-11-09T22:30:00Z'))).toBe('2026-11-08');
  });
});

describe('changeOf / formatChange', () => {
  it('computes percentage change and handles a zero baseline', () => {
    expect(changeOf(120, 100, 'pct')).toBeCloseTo(0.2);
    expect(changeOf(5, 0, 'pct')).toBeNull();
    expect(changeOf(0, 0, 'pct')).toBe(0);
    expect(formatChange(null, 'pct')).toBe('n/a');
  });

  it('computes percentage-point change for rates', () => {
    expect(changeOf(0.25, 0.2, 'pp')).toBeCloseTo(0.05);
    expect(formatChange(changeOf(0.25, 0.2, 'pp'), 'pp')).toBe('+5.0 pp');
  });
});

describe('retentionSummary', () => {
  it('weights day-1 return across cohorts and reports missing day-7 as n/a', () => {
    const rows = [...retentionRows, { date: '2026-11-08 00:00:00', day: 0, visitors: 50, returnVisitors: 50, percentage: 100 }, { date: '2026-11-08 00:00:00', day: 1, visitors: 50, returnVisitors: 5, percentage: 10 }];
    const r = retentionSummary(rows);
    expect(r.day1.rate).toBeCloseTo(8 / 121);
    expect(r.day1.cohorts).toBe(2);
    expect(r.day7.rate).toBeNull();
    expect(r.day7.cohorts).toBe(0);
  });

  it('tolerates a missing response', () => {
    expect(retentionSummary(undefined).day1.rate).toBeNull();
  });
});

describe('top lists', () => {
  const urls = [
    { x: '/trails/a/', y: 3 },
    { x: '/trails/a', y: 2 },
    { x: '/trails/b', y: 9 },
    { x: '/map', y: 50 },
    { x: '/trails/', y: 1 },
    { x: null, y: 4 },
  ];

  it('keeps only spot urls and strips trailing slashes', () => {
    expect(topSpots(urls)).toEqual([{ key: '/trails/b', count: 9 }, { key: '/trails/a', count: 5 }]);
  });

  it('merges trailing-slash duplicates and drops /embed iframe views', () => {
    const rows = [{ x: '/map', y: 37 }, { x: '/map/', y: 20 }, { x: '/embed/abc/', y: 13 }, { x: '/', y: 41 }];
    expect(topPages(rows)).toEqual([{ key: '/map', count: 57 }, { key: '/', count: 41 }]);
  });

  it('ranks pages by count and drops null urls', () => {
    expect(topPages(urls, 2)).toEqual([{ key: '/map', count: 50 }, { key: '/trails/b', count: 9 }]);
  });

  it('labels null and empty referrers as direct', () => {
    expect(topReferrers([{ x: null, y: 4 }, { x: '', y: 1 }, { x: 'google.com', y: 2 }])).toEqual([
      { key: 'direct', count: 5 },
      { key: 'google.com', count: 2 },
    ]);
  });

  it('turns device counts into shares', () => {
    const d = deviceShares([{ x: 'desktop', y: 3 }, { x: 'mobile', y: 1 }]);
    expect(d.map(x => [x.key, x.share])).toEqual([['desktop', 0.75], ['mobile', 0.25]]);
  });
});

describe('experiment progress', () => {
  it('estimates days left from the lead arm pace', () => {
    // min 90 visits after 4 days -> 22.5/day; need 210 more -> ceil(9.33) = 10
    const p = experimentProgress({ variants: ['a', 'b'], visitsByVariant: { a: 120, b: 90 }, minVisitsPerVariant: 300, daysSoFar: 4 });
    expect(p.minVisits).toBe(90);
    expect(p.ready).toBe(false);
    expect(p.daysLeft).toBe(10);
  });

  it('is ready once every arm reached the minimum', () => {
    const p = experimentProgress({ variants: ['a', 'b'], visitsByVariant: { a: 310, b: 300 }, minVisitsPerVariant: 300, daysSoFar: 9 });
    expect(p.ready).toBe(true);
    expect(p.daysLeft).toBe(0);
  });

  it('has no estimate without visits', () => {
    const p = experimentProgress({ variants: ['a', 'b'], visitsByVariant: {}, minVisitsPerVariant: 300, daysSoFar: 1 });
    expect(p.daysLeft).toBeNull();
  });

  it('reads visits per variant from tag metrics', () => {
    expect(tagVisits({ 'aa-baseline:a': 4, 'other:a': 99 }, 'aa-baseline', ['a', 'b'])).toEqual({ a: 4, b: 0 });
  });
});

describe('overview', () => {
  it('builds rows with pp change for rates and pct change for counts', () => {
    const base = { visits: 100, visitors: 80, avgVisitSeconds: 60, bounceRate: 0.4, engagedRate: 0.3, spotOpenPerVisit: 0.5 };
    const day = { visits: 110, visitors: 80, avgVisitSeconds: 60, bounceRate: 0.5, engagedRate: 0.3, spotOpenPerVisit: 0.5 };
    const rows = buildOverview(day, base);
    expect(rows.find(r => r.label === 'Visits').change).toBeCloseTo(0.1);
    expect(rows.find(r => r.label === 'Bounce rate').kind).toBe('pp');
    expect(rows.find(r => r.label === 'Bounce rate').change).toBeCloseTo(0.1);
  });

  it('averages daily counts and sums rate totals for the baseline', () => {
    const day = (visits: number, bounces: number) => ({ stats: { visits, visitors: visits, pageviews: visits, bounces, totaltime: visits * 10 }, events: {} });
    const b = aggregateBaseline([day(10, 5), day(30, 5)]);
    expect(b.visits).toBe(20);
    expect(b.bounceRate).toBeCloseTo(10 / 40);
  });
});

describe('renderDailyMarkdown', () => {
  it('renders the overview, the fixed caveat and the no-experiment note', async () => {
    const md = renderDailyMarkdown({
      day: '2026-11-09',
      window: { day: dayWindow('2026-11-09'), baseline: dayWindow('2026-11-02') },
      overview: buildOverview({ visits: 10, visitors: 8, avgVisitSeconds: 30, bounceRate: 0.5, engagedRate: 0.2, spotOpenPerVisit: 1 }, { visits: 5, visitors: 4, avgVisitSeconds: 30, bounceRate: 0.5, engagedRate: 0.2, spotOpenPerVisit: 1 }),
      visitsPerVisitor: 1.25,
      retention: retentionSummary(retentionRows),
      topPages: [],
      topSpots: [],
      referrers: [],
      devices: [],
      experiment: null,
    });
    expect(md).toContain('| Visits | 10 | 5 | +100.0% |');
    expect(md).toContain('Lower bound: Umami re-identifies by IP');
    expect(md).toContain('No active experiment.');
    expect(md).toContain('Day-7 return: n/a');
  });
});

describe('collectDailyReport', () => {
  function mockUmami({ retention = retentionRows } = {}) {
    const calls: Array<{ path: string; params: Record<string, string>; method: string; headers: Record<string, string>; body?: any }> = [];
    const fetchFn = vi.fn(async (url: string, init: any = {}) => {
      const u = new URL(url);
      calls.push({
        path: u.pathname,
        params: Object.fromEntries(u.searchParams),
        method: init.method ?? 'GET',
        headers: init.headers ?? {},
        body: init.body ? JSON.parse(init.body) : undefined,
      });
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (u.pathname === '/api/auth/login') return ok({ token: 'tok' });
      if (u.pathname === '/api/reports/retention') return ok(retention);
      if (u.pathname.endsWith('/stats')) {
        return ok({ pageviews: { value: 10 }, visitors: { value: 5 }, visits: { value: 6 }, bounces: { value: 2 }, totaltime: { value: 600 } });
      }
      if (u.pathname.endsWith('/metrics')) {
        const rows: Record<string, unknown[]> = {
          url: [{ x: '/trails/a/', y: 3 }, { x: '/map', y: 7 }],
          referrer: [{ x: null, y: 2 }],
          device: [{ x: 'desktop', y: 4 }, { x: 'mobile', y: 2 }],
          event: [{ x: 'engaged', y: 3 }, { x: 'spot_open', y: 2 }],
          tag: [{ x: 'aa-baseline:a', y: 4 }, { x: 'aa-baseline:b', y: 5 }],
        };
        return ok(rows[u.searchParams.get('type') ?? ''] ?? []);
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });
    return { fetchFn, calls };
  }

  const registry = {
    active: 'aa-baseline',
    experiments: [{ id: 'aa-baseline', hypothesis: 'A/A', variants: ['a', 'b'], primaryMetric: 'engagedRate', minVisitsPerVariant: 300, status: 'running', startedAt: '2026-11-01' }],
  };

  it('sends the Bearer token, the retention body and the requested metric types', async () => {
    const { fetchFn, calls } = mockUmami();
    const report = await collectDailyReport({ fetch: fetchFn, baseUrl: 'https://umami.test', websiteId: '7', username: 'u', password: 'p', day: '2026-11-09', registry });

    const login = calls.find(c => c.path === '/api/auth/login');
    expect(login?.method).toBe('POST');
    expect(login?.body).toEqual({ username: 'u', password: 'p' });

    const authed = calls.filter(c => c.path !== '/api/auth/login');
    expect(authed.length).toBeGreaterThan(0);
    expect(authed.every(c => c.headers.Authorization === 'Bearer tok')).toBe(true);

    const retentionCall = calls.find(c => c.path === '/api/reports/retention');
    expect(retentionCall?.method).toBe('POST');
    expect(retentionCall?.body).toEqual({
      websiteId: '7',
      dateRange: {
        startDate: new Date(Date.parse('2026-10-13T00:00:00+02:00')).toISOString(),
        endDate: new Date(Date.parse('2026-11-10T00:00:00+01:00') - 1).toISOString(),
      },
      timezone: 'Europe/Berlin',
    });

    const types = new Set(calls.filter(c => c.path.endsWith('/metrics')).map(c => c.params.type));
    expect(types).toEqual(new Set(['url', 'referrer', 'device', 'event', 'tag']));

    // One stats call for the day and one per baseline day.
    expect(calls.filter(c => c.path.endsWith('/stats'))).toHaveLength(8);

    expect(report.topSpots).toEqual([{ key: '/trails/a', count: 3 }]);
    expect(report.topPages[0]).toEqual({ key: '/map', count: 7 });
    expect(report.referrers).toEqual([{ key: 'direct', count: 2 }]);
    expect(report.experiment.variants).toEqual([{ variant: 'a', visits: 4 }, { variant: 'b', visits: 5 }]);
    expect(report.experiment.minVisits).toBe(4);
    expect(report.experiment.daysLeft).toBe(Math.ceil((300 - 4) / (4 / 9)));
  });

  it('skips the experiment when the day is before its start', async () => {
    const { fetchFn, calls } = mockUmami();
    const report = await collectDailyReport({ fetch: fetchFn, baseUrl: 'https://umami.test', websiteId: '7', username: 'u', password: 'p', day: '2026-10-20', registry });
    expect(report.experiment.notStarted).toBe(true);
    expect(calls.some(c => c.params.type === 'tag')).toBe(false);
  });
});
