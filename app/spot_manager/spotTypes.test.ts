import { describe, it, expect } from 'vitest';
import { SPOT_CAPABILITIES } from './spotTypes';

const TYPES = ['trail', 'bikepark', 'dirtpark'] as const;

describe('SPOT_CAPABILITIES', () => {
  it('has an entry for every trail type', () => {
    for (const t of TYPES) expect(SPOT_CAPABILITIES[t]).toBeDefined();
  });
  it('only trail and bikepark are manageable', () => {
    expect(TYPES.filter(t => SPOT_CAPABILITIES[t].manageable)).toEqual(['trail', 'bikepark']);
  });
  it('only trail has gpx', () => {
    expect(TYPES.filter(t => SPOT_CAPABILITIES[t].gpx)).toEqual(['trail']);
  });
  it('details kind is trail, bikepark or null', () => {
    for (const t of TYPES) expect(['trail', 'bikepark', null]).toContain(SPOT_CAPABILITIES[t].details);
  });
  it('maps to the right tables and labels', () => {
    expect(SPOT_CAPABILITIES.bikepark).toMatchObject({ table: 'parks', label: 'Bikepark' });
    expect(SPOT_CAPABILITIES.trail.table).toBe('trails');
    expect(SPOT_CAPABILITIES.dirtpark.table).toBe('dirt_parks');
  });
});
