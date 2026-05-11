import { describe, it, expect } from 'vitest';
import { giveTrailNearBy } from './near_by_trails';
import { SingleTrail } from './types/Trail';

function makeTrail(lat: number, lng: number, name = 'Trail'): SingleTrail {
  return {
    type: 'trail',
    name,
    id: `${lat}-${lng}`,
    creator: '',
    url: '',
    instagram: '',
    latitude: lat,
    longitude: lng,
    spotcheck: '',
    approved: true,
    created_at: '2024-01-01',
  };
}

describe('giveTrailNearBy', () => {
  const munich = makeTrail(48.137, 11.576, 'Munich Trail');

  it('returns a trail that is within 3 km radius', () => {
    // ~1.5 km north of munich trail
    const result = giveTrailNearBy(48.151, 11.576, [munich]);
    expect(result).toBe(munich);
  });

  it('returns undefined when no trail is within 3 km', () => {
    // ~50 km north
    const result = giveTrailNearBy(48.587, 11.576, [munich]);
    expect(result).toBeUndefined();
  });

  it('returns the first matching trail when multiple are close', () => {
    const trail1 = makeTrail(48.137, 11.576, 'First');
    const trail2 = makeTrail(48.138, 11.577, 'Second');
    const result = giveTrailNearBy(48.137, 11.576, [trail1, trail2]);
    expect(result).toBe(trail1);
  });

  it('returns undefined for an empty trail list', () => {
    expect(giveTrailNearBy(48.137, 11.576, [])).toBeUndefined();
  });

  it('handles a point exactly on the trail coordinates', () => {
    const result = giveTrailNearBy(48.137, 11.576, [munich]);
    expect(result).toBe(munich);
  });

  it('correctly handles longitude boundary near the 3 km limit', () => {
    // ~3.1 km east at this latitude (cos(48°) ≈ 0.669, so dLon ≈ 3/(111.32*0.669) ≈ 0.0403 deg)
    const justOutside = giveTrailNearBy(48.137, 11.576 + 0.045, [munich]);
    expect(justOutside).toBeUndefined();
  });
});
