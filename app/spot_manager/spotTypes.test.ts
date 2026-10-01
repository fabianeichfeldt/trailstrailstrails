import { describe, it, expect } from 'vitest';
import { SPOT_CAPABILITIES } from './spotTypes';
import type { anyTrailType } from '../types/Trail';

const ALL: anyTrailType[] = ['trail', 'bikepark', 'dirtpark'];

describe('SPOT_CAPABILITIES', () => {
  it('has an entry for every spot type', () => {
    expect(Object.keys(SPOT_CAPABILITIES).sort()).toEqual([...ALL].sort());
  });

  it('only trail and bikepark are manageable', () => {
    const manageable = ALL.filter(t => SPOT_CAPABILITIES[t].manageable);
    expect(manageable.sort()).toEqual(['bikepark', 'trail']);
  });

  it('only trail has gpx', () => {
    expect(ALL.filter(t => SPOT_CAPABILITIES[t].gpx)).toEqual(['trail']);
  });

  it('maps details editor kind per type', () => {
    expect(SPOT_CAPABILITIES.trail.details).toBe('trail');
    expect(SPOT_CAPABILITIES.bikepark.details).toBe('bikepark');
    expect(SPOT_CAPABILITIES.dirtpark.details).toBeNull();
  });

  it('maps tables', () => {
    expect(SPOT_CAPABILITIES.trail.table).toBe('trails');
    expect(SPOT_CAPABILITIES.bikepark.table).toBe('parks');
    expect(SPOT_CAPABILITIES.dirtpark.table).toBe('dirt_parks');
  });
});
