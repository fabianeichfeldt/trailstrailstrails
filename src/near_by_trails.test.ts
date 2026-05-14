import { describe, it, expect } from 'vitest';
import { giveTrailNearBy } from './near_by_trails';
import type { SingleTrail, BikePark, DirtPark } from './types/Trail';

const BASE = {
  id: 'x',
  creator: '',
  url: '',
  instagram: '',
  spotcheck: '',
  approved: true,
  created_at: '2024-01-01',
}

function makeTrail(lat: number, lng: number, name = 'Trail'): SingleTrail {
  return { ...BASE, type: 'trail', name, id: `${lat}-${lng}`, latitude: lat, longitude: lng }
}

function makeBikePark(lat: number, lng: number, name = 'Bikepark'): BikePark {
  return { ...BASE, type: 'bikepark', name, id: `b-${lat}-${lng}`, latitude: lat, longitude: lng }
}

function makeDirtPark(lat: number, lng: number, name = 'Dirtpark'): DirtPark {
  return { ...BASE, type: 'dirtpark', name, id: `d-${lat}-${lng}`, latitude: lat, longitude: lng, pumptrack: true, dirtpark: false }
}

describe('giveTrailNearBy — 5 km radius', () => {
  const munich = makeTrail(48.137, 11.576, 'Munich Trail');

  it('returns a trail within 5 km (≈ 1.5 km north)', () => {
    expect(giveTrailNearBy(48.151, 11.576, [munich])).toBe(munich);
  });

  it('returns a trail within 5 km (≈ 4 km north)', () => {
    // ~4.4 km north — inside 5 km
    expect(giveTrailNearBy(48.177, 11.576, [munich])).toBe(munich);
  });

  it('returns undefined when no trail is within 5 km', () => {
    // ~50 km north — clearly outside
    expect(giveTrailNearBy(48.587, 11.576, [munich])).toBeUndefined();
  });

  it('returns undefined just outside the 5 km bounding box (longitude)', () => {
    // At lat 48.137, cos ≈ 0.667 → dLon ≈ 5/(111.32×0.667) ≈ 0.0674 °
    // 0.08 ° ≈ 5.95 km east — outside
    expect(giveTrailNearBy(48.137, 11.576 + 0.08, [munich])).toBeUndefined();
  });

  it('returns a trail just inside the 5 km bounding box (longitude)', () => {
    // 0.06 ° ≈ 4.47 km east — inside
    expect(giveTrailNearBy(48.137, 11.576 + 0.06, [munich])).toBe(munich);
  });

  it('returns undefined just outside the 5 km bounding box (latitude)', () => {
    // dLat = 5/111.32 ≈ 0.0449 °; use 0.05 ° ≈ 5.56 km north
    expect(giveTrailNearBy(48.137 + 0.05, 11.576, [munich])).toBeUndefined();
  });

  it('returns the first matching trail when multiple are close', () => {
    const t1 = makeTrail(48.137, 11.576, 'First');
    const t2 = makeTrail(48.138, 11.577, 'Second');
    expect(giveTrailNearBy(48.137, 11.576, [t1, t2])).toBe(t1);
  });

  it('returns undefined for an empty list', () => {
    expect(giveTrailNearBy(48.137, 11.576, [])).toBeUndefined();
  });

  it('returns a spot exactly on the coordinates', () => {
    expect(giveTrailNearBy(48.137, 11.576, [munich])).toBe(munich);
  });
});

// ── All spot types ────────────────────────────────────────────────────────────

describe('giveTrailNearBy — all spot types', () => {
  it('detects a BikePark within 5 km', () => {
    const bp = makeBikePark(48.137, 11.576);
    expect(giveTrailNearBy(48.140, 11.576, [bp])).toBe(bp);
  });

  it('detects a DirtPark within 5 km', () => {
    const dp = makeDirtPark(48.137, 11.576);
    expect(giveTrailNearBy(48.140, 11.576, [dp])).toBe(dp);
  });

  it('returns undefined when only a BikePark is far away', () => {
    const bp = makeBikePark(47.0, 10.0);
    expect(giveTrailNearBy(48.137, 11.576, [bp])).toBeUndefined();
  });

  it('returns undefined when only a DirtPark is far away', () => {
    const dp = makeDirtPark(47.0, 10.0);
    expect(giveTrailNearBy(48.137, 11.576, [dp])).toBeUndefined();
  });

  it('finds a trail even when mixed with out-of-range bikeparks', () => {
    const trail = makeTrail(48.137, 11.576);
    const farBp = makeBikePark(47.0, 10.0);
    expect(giveTrailNearBy(48.137, 11.576, [farBp, trail])).toBe(trail);
  });

  it('returns the first nearby spot regardless of type order', () => {
    const bp = makeBikePark(48.137, 11.576, 'Near Bikepark');
    const trail = makeTrail(48.137, 11.576, 'Near Trail');
    // bikepark is first — should be returned
    expect(giveTrailNearBy(48.140, 11.576, [bp, trail])).toBe(bp);
  });
});
