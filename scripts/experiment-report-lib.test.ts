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
  const arm = (engagedCount: number, visits: number) => ({ engagedCount, visits });
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

describe('collectReport (mocked fetch)', () => {
  it('logs in, then queries stats and metrics per variant with Bearer + tag', async () => {
    const calls: { url: string; init?: any }[] = [];
    const fetchMock = vi.fn(async (url: string, init?: any) => {
      calls.push({ url, init });
      const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
      if (url.endsWith('/api/auth/login')) return json({ token: 'tok' });
      if (url.includes('/stats')) return json({ visits: { value: 400 }, visitors: 300, pageviews: 900, bounces: 100, totaltime: 40000 });
      return json([{ x: 'engaged', y: 120 }, { x: 'spot_open', y: 200 }]);
    });
    const report = await collectReport({
      fetch: fetchMock, baseUrl: 'http://localhost:9', websiteId: 'w1', username: 'u', password: 'p',
      experiment: { id: 'exp', hypothesis: 'h', variants: ['a', 'b'], primaryMetric: 'engagedRate', minVisitsPerVariant: 300 },
      startAt: 1000, endAt: 2000,
    });
    expect(JSON.parse(calls[0].init.body)).toEqual({ username: 'u', password: 'p' });
    const stats = calls.filter(c => c.url.includes('/api/websites/w1/stats'));
    expect(stats).toHaveLength(3);
    expect(new URL(stats[0].url).searchParams.get('tag')).toBe('exp:a');
    expect(new URL(stats[1].url).searchParams.get('tag')).toBe('exp:b');
    expect(new URL(stats[2].url).searchParams.has('tag')).toBe(false);
    const metrics = calls.find(c => c.url.includes('/metrics'))!;
    expect(new URL(metrics.url).searchParams.get('type')).toBe('event');
    expect(calls.slice(1).every(c => c.init.headers.Authorization === 'Bearer tok')).toBe(true);
    expect(report.variants[0].engagedRate).toBeCloseTo(0.3);
    expect(report.comparisons[0].verdict).toBe('no_difference');
    expect(renderMarkdown(report)).toContain('no_difference');
  });

  it('fails clearly when login is rejected', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(collectReport({ fetch: f, baseUrl: 'http://x', websiteId: 'w', username: 'u', password: 'bad', experiment: { id: 'e', variants: ['a', 'b'], minVisitsPerVariant: 1 }, startAt: 0, endAt: 1 })).rejects.toThrow('login failed (401)');
  });
});
