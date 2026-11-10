import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain .mjs
import * as lib from './experiment-report-lib.mjs';

const { normaliseStats, normaliseMetrics, computeMetrics, twoProportionZ, verdict, collectReport, renderMarkdown } = lib;

describe('normalisation', () => {
  it('handles the nested {value, prev} stats shape', () => {
    const s = normaliseStats({ visits: { value: 10, prev: 2 }, visitors: { value: 8 }, pageviews: { value: 30 }, bounces: { value: 3 }, totaltime: { value: 500 } });
    expect(s).toEqual({ visits: 10, visitors: 8, pageviews: 30, bounces: 3, totaltime: 500 });
  });
  it('handles the flat stats shape and missing fields', () => {
    expect(normaliseStats({ visits: 5, totaltime: 100 })).toEqual({ visits: 5, visitors: 0, pageviews: 0, bounces: 0, totaltime: 100 });
    expect(normaliseStats(undefined).visits).toBe(0);
  });
  it('handles x/y, name/value and {data} metric shapes', () => {
    expect(normaliseMetrics([{ x: 'engaged', y: 4 }])).toEqual({ engaged: 4 });
    expect(normaliseMetrics({ data: [{ name: 'like', value: '2' }] })).toEqual({ like: 2 });
    expect(normaliseMetrics(null)).toEqual({});
  });
});

describe('computeMetrics', () => {
  it('derives per-visit metrics', () => {
    const m = computeMetrics({ visits: 100, visitors: 90, pageviews: 200, bounces: 40, totaltime: 6000 }, { engaged: 30, spot_open: 50, search: 20 });
    expect(m.avgVisitSeconds).toBe(60);
    expect(m.bounceRate).toBe(0.4);
    expect(m.engagedRate).toBe(0.3);
    expect(m.spotOpenPerVisit).toBe(0.5);
    expect(m.eventsPerVisit).toBe(1);
  });
  it('caps engaged rate at 1 and survives zero visits', () => {
    expect(computeMetrics({ visits: 10, visitors: 0, pageviews: 0, bounces: 0, totaltime: 0 }, { engaged: 15 }).engagedRate).toBe(1);
    expect(computeMetrics({ visits: 0, visitors: 0, pageviews: 0, bounces: 0, totaltime: 0 }, {}).avgVisitSeconds).toBe(0);
  });
});

describe('twoProportionZ', () => {
  it('matches the known value for 120/400 vs 150/400', () => {
    const t = twoProportionZ(120, 400, 150, 400);
    expect(t.diff).toBeCloseTo(0.075, 6);
    expect(t.z).toBeCloseTo(2.243, 2);
    expect(t.pValue).toBeCloseTo(0.0249, 3);
    expect(t.lift).toBeCloseTo(0.25, 6);
    expect(t.ci95[0]).toBeGreaterThan(0);
    expect(t.ci95[0]).toBeLessThan(0.075);
    expect(t.ci95[1]).toBeGreaterThan(0.075);
  });
});

describe('verdict', () => {
  const arm = (engagedVisits: number, visits: number) => ({ engagedVisits, visits });
  it('need_more_data when any arm is below the minimum', () => {
    expect(verdict(arm(120, 400), arm(250, 299), 300)).toBe('need_more_data');
    expect(verdict(arm(10, 100), arm(50, 400), 300)).toBe('need_more_data');
  });
  it('winner / loser / no_difference with enough data', () => {
    expect(verdict(arm(120, 400), arm(150, 400), 300)).toBe('winner');
    expect(verdict(arm(150, 400), arm(120, 400), 300)).toBe('loser');
    expect(verdict(arm(120, 400), arm(125, 400), 300)).toBe('no_difference');
  });
});

const act = (visitId: string, at: number, extra: Record<string, unknown> = {}) => ({ visitId, sessionId: 's-' + visitId, createdAt: new Date(at).toISOString(), urlPath: '/map', tag: null, eventType: 2, eventName: null, ...extra });
const ev = (visitId: string, at: number, name: string, tag: string | null) => act(visitId, at, { eventName: name, tag });
const pv = (visitId: string, at: number, tag: string | null) => act(visitId, at, { eventType: 1, tag });

describe('collectReport (mocked fetch)', () => {
  function mock() {
    const calls: { url: string; init?: any }[] = [];
    // visit a1 engaged (2 actions), a2 bounce, b1 engaged
    const activity: Record<string, unknown[]> = {
      sa1: [pv('a1', 0, 'exp:a'), ev('a1', 1000, 'search', 'exp:a'), ev('a1', 20000, 'like', 'exp:a'), ev('a1', 30000, 'active', 'exp:a')],
      sa2: [pv('a2', 0, 'exp:a')],
      sb1: [pv('b1', 0, 'exp:b'), ev('b1', 1000, 'share', 'exp:b'), ev('b1', 2000, 'locate_me', 'exp:b')],
    };
    const fetchMock = vi.fn(async (url: string, init?: any) => {
      calls.push({ url, init });
      const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
      const u = new URL(url);
      if (u.pathname.endsWith('/api/auth/login')) return json({ token: 'tok' });
      if (u.pathname.endsWith('/sessions')) return json({ data: [{ id: 'sa1' }, { id: 'sa2' }, { id: 'sb1' }], count: 3, page: 1, pageSize: 100 });
      const m = u.pathname.match(/\/sessions\/(.+)\/activity$/);
      if (m) return json(activity[m[1]].map((a: any) => ({ ...a, sessionId: m[1] })));
      if (u.pathname.endsWith('/stats')) return json({ visits: { value: 400 }, visitors: 300, pageviews: 900, bounces: 100, totaltime: 40000 });
      return json([]);
    });
    return { fetchMock, calls };
  }
  const exp = { id: 'exp', hypothesis: 'h', variants: ['a', 'b'], primaryMetric: 'engagedRate', minVisitsPerVariant: 300 };

  it('derives variants from raw visits and keeps only an all-traffic Umami row', async () => {
    const { fetchMock, calls } = mock();
    const report = await collectReport({ fetch: fetchMock, baseUrl: 'http://localhost:9', websiteId: 'w1', username: 'u', password: 'p', experiment: exp, startAt: 1000, endAt: 2000 });
    expect(JSON.parse(calls[0].init.body)).toEqual({ username: 'u', password: 'p' });
    expect(calls.slice(1).every(c => c.init.headers.Authorization === 'Bearer tok')).toBe(true);
    expect(report.variants[0]).toMatchObject({ variant: 'a', visits: 2, engagedVisits: 1, engagedRate: 0.5, bounceRate: 0.5, activeTimeMedian: 15 });
    expect(report.variants[1]).toMatchObject({ variant: 'b', visits: 1, engagedRate: 1 });
    // Only the cross-check row uses /stats; no per-variant tag queries.
    const stats = calls.filter(c => c.url.includes('/stats'));
    expect(stats).toHaveLength(1);
    expect(new URL(stats[0].url).searchParams.has('tag')).toBe(false);
    expect(report.comparisons[0].verdict).toBe('need_more_data');
    const md = renderMarkdown(report);
    expect(md).toContain('Engagement v2: computed from raw events');
    expect(md).toContain('| Variant | Visits | Engaged rate | Actions/visit | Active time median (s) | Bounce rate | Spot views/visit |');
    expect(md).toContain('all traffic (Umami)');
  });

  it('fails clearly when login is rejected', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(collectReport({ fetch: f, baseUrl: 'http://x', websiteId: 'w', username: 'u', password: 'bad', experiment: { id: 'e', variants: ['a', 'b'], minVisitsPerVariant: 1 }, startAt: 0, endAt: 1 })).rejects.toThrow('login failed (401)');
  });
});
