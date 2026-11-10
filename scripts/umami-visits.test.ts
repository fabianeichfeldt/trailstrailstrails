import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain .mjs
import * as lib from './umami-visits.mjs';

const { fetchVisits, groupIntoVisits, countActions, summariseVisits, groupByTag, ENGAGEMENT_RULES } = lib;

let n = 0;
const act = (visitId: string, sec: number, o: Record<string, unknown> = {}) => ({
  id: `e${n++}`, visitId, sessionId: `s-${visitId}`, createdAt: new Date(1_700_000_000_000 + sec * 1000).toISOString(),
  urlPath: '/map', tag: null, eventType: 2, eventName: null, ...o,
});
const pv = (v: string, sec: number, o = {}) => act(v, sec, { eventType: 1, ...o });
const ev = (v: string, sec: number, name: string, o = {}) => act(v, sec, { eventName: name, ...o });
const visit = (acts: any[]) => groupIntoVisits(acts)[0];

describe('groupIntoVisits', () => {
  it('groups by visitId across sessions, sorts events, picks the majority tag', () => {
    const vs = groupIntoVisits([
      ev('v1', 5, 'search', { tag: 'e:b', sessionId: 'sX' }),
      pv('v1', 0, { tag: 'e:a' }),
      ev('v1', 9, 'like', { tag: 'e:b' }),
      pv('v2', 100),
    ]);
    expect(vs).toHaveLength(2);
    expect(vs[0].tag).toBe('e:b');
    expect(vs[0].events.map((e: any) => e.type)).toEqual(['pageview', 'event', 'event']);
    expect(vs[0].startedAt).toBeLessThan(vs[0].endedAt);
    expect(vs[1].tag).toBeNull();
  });

  it('skips /embed/ events', () => {
    const vs = groupIntoVisits([pv('v1', 0, { urlPath: '/embed/tok' }), pv('v2', 0)]);
    expect(vs.map((v: any) => v.visitId)).toEqual(['v2']);
  });
});

describe('countActions', () => {
  it('merges spot_open within 5 s after map_pin_open or search', () => {
    expect(countActions(visit([pv('v', 0), ev('v', 1, 'map_pin_open'), ev('v', 5, 'spot_open')]))).toBe(1);
    expect(countActions(visit([pv('v', 0), ev('v', 1, 'search'), ev('v', 4, 'spot_open')]))).toBe(1);
  });
  it('counts a spot_open 6 s after the pin as a second action', () => {
    expect(countActions(visit([pv('v', 0), ev('v', 1, 'map_pin_open'), ev('v', 7, 'spot_open')]))).toBe(2);
  });
  it('never counts spot_land, active, engaged or pageviews', () => {
    expect(countActions(visit([pv('v', 0), pv('v', 1), ev('v', 2, 'spot_land'), ev('v', 3, 'active'), ev('v', 4, 'engaged')]))).toBe(0);
  });
  it('exposes the rules in one place', () => {
    expect(ENGAGEMENT_RULES.minActionsEngaged).toBe(2);
    expect(ENGAGEMENT_RULES.countedActions).not.toContain('spot_land');
  });
});

describe('summariseVisits', () => {
  const bounce = [pv('b', 0)];
  const one = [pv('o', 0), ev('o', 1, 'like')];
  const two = [pv('t', 0), ev('t', 1, 'like'), ev('t', 2, 'share'), ev('t', 3, 'spot_land'), ev('t', 60, 'active')];
  const s = summariseVisits(groupIntoVisits([...bounce, ...one, ...two]));

  it('applies the engaged threshold and bounce rule', () => {
    expect(s.visits).toBe(3);
    expect(s.engagedVisits).toBe(1);
    expect(s.engagedRate).toBeCloseTo(1 / 3);
    expect(s.bounceRate).toBeCloseTo(1 / 3);
    expect(s.actionsPerVisit).toBeCloseTo(3 / 3);
    expect(s.spotViewsPerVisit).toBeCloseTo(1 / 3);
  });
  it('measures active time including heartbeats, with median and mean', () => {
    // durations 0, 1, 60
    expect(s.activeTimeMedian).toBe(1);
    expect(s.activeTimeMean).toBeCloseTo(61 / 3);
  });
  it('averages the middle pair for an even count and survives no visits', () => {
    expect(summariseVisits(groupIntoVisits([pv('a', 0), ev('a', 10, 'active'), pv('b', 0), ev('b', 20, 'active')])).activeTimeMedian).toBe(15);
    expect(summariseVisits([]).engagedRate).toBe(0);
  });
});

describe('groupByTag', () => {
  it('buckets by variant and ignores other tags', () => {
    const vs = groupIntoVisits([pv('a', 0, { tag: 'e:a' }), pv('b', 0, { tag: 'e:b' }), pv('c', 0, { tag: 'other:x' }), pv('d', 0)]);
    const g = groupByTag(vs, 'e:');
    expect(Object.keys(g).sort()).toEqual(['a', 'b']);
    expect(g.a).toHaveLength(1);
  });
});

describe('fetchVisits (mocked fetch)', () => {
  it('paginates sessions and honours the concurrency limit', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `s${i}`);
    let inFlight = 0;
    let maxInFlight = 0;
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init: any) => {
      expect(init.headers.Authorization).toBe('Bearer tok');
      const u = new URL(url);
      calls.push(u.pathname + u.search);
      const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
      if (u.pathname.endsWith('/sessions')) {
        const page = Number(u.searchParams.get('page'));
        expect(u.searchParams.get('pageSize')).toBe('100');
        return ok({ data: ids.slice((page - 1) * 100, page * 100).map(id => ({ id })), count: 150, page, pageSize: 100 });
      }
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 1));
      inFlight--;
      const sid = u.pathname.split('/')[5];
      return ok([act(`v-${sid}`, 0, { eventType: 1, sessionId: sid })]);
    });
    const visits = await fetchVisits({ fetch: fetchMock, baseUrl: 'http://x', token: 'tok', websiteId: 'w', startAt: 1, endAt: 2, concurrency: 3 });
    expect(visits).toHaveLength(150);
    expect(calls.filter(c => c.includes('/sessions?'))).toHaveLength(2);
    expect(calls.filter(c => c.includes('/activity'))).toHaveLength(150);
    expect(maxInFlight).toBeLessThanOrEqual(3);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('accepts a {data} activity wrapper and fails on HTTP errors', async () => {
    const f = vi.fn(async (url: string) => {
      const u = new URL(url);
      if (u.pathname.endsWith('/sessions')) return { ok: true, json: async () => ({ data: [{ id: 's' }], count: 1 }) };
      return { ok: true, json: async () => ({ data: [act('v', 0, { eventType: 1 })] }) };
    });
    expect(await fetchVisits({ fetch: f, baseUrl: 'http://x', token: 't', websiteId: 'w', startAt: 1, endAt: 2 })).toHaveLength(1);
    const bad = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await expect(fetchVisits({ fetch: bad, baseUrl: 'http://x', token: 't', websiteId: 'w', startAt: 1, endAt: 2 })).rejects.toThrow('500');
  });
});
