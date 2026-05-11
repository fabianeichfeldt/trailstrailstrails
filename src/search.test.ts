import { describe, it, expect } from 'vitest';
import { trailScore } from './search';
import { SingleTrail } from './types/Trail';

function makeTrail(name: string): SingleTrail {
  return {
    type: 'trail',
    name,
    id: '1',
    creator: '',
    url: '',
    instagram: '',
    latitude: 48.0,
    longitude: 11.5,
    spotcheck: '',
    approved: true,
    created_at: '2024-01-01',
  };
}

describe('trailScore', () => {
  it('returns 100 for an exact match (case-insensitive)', () => {
    expect(trailScore(makeTrail('Flowtrail'), 'flowtrail')).toBe(100);
    expect(trailScore(makeTrail('Flowtrail'), 'Flowtrail')).toBe(100);
  });

  it('returns 80 when the name starts with the query', () => {
    expect(trailScore(makeTrail('Flowtrail Tegernsee'), 'flow')).toBe(80);
  });

  it('returns 60 when the name contains the query but does not start with it', () => {
    expect(trailScore(makeTrail('Mega Flowtrail'), 'flow')).toBe(60);
  });

  it('returns 60 when a word within the name starts with the query (word-boundary check is a subset of includes)', () => {
    // "downhill" starts with "down", but name.includes("down") catches it first → score 60, not 40
    expect(trailScore(makeTrail('Black Forest Downhill'), 'down')).toBe(60);
  });

  it('returns 0 when there is no match', () => {
    expect(trailScore(makeTrail('Waldpfad'), 'xyz')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(trailScore(makeTrail('Waldpfad'), 'WALD')).toBe(80);
  });

  it('exact match scores higher than prefix match', () => {
    const exact = trailScore(makeTrail('Flow'), 'flow');
    const prefix = trailScore(makeTrail('Flowtrail'), 'flow');
    expect(exact).toBeGreaterThan(prefix);
  });

  it('prefix match scores higher than substring match', () => {
    const prefix = trailScore(makeTrail('Flowtrail Tegernsee'), 'flow');
    const substring = trailScore(makeTrail('Mega Flowtrail'), 'flow');
    expect(prefix).toBeGreaterThan(substring);
  });
});
