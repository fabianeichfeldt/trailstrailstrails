import { describe, it, expect } from 'vitest';
import { SPOT_CAPABILITIES } from './spotTypes';

const TYPES = ['trail', 'bikepark', 'dirtpark'] as const;

describe('SPOT_CAPABILITIES', () => {
  it('has an entry for every trail type', () => {
    for (const t of TYPES) expect(SPOT_CAPABILITIES[t]).toBeDefined();
  });
  it('all spot types are manageable', () => {
    expect(TYPES.filter(t => SPOT_CAPABILITIES[t].manageable)).toEqual(['trail', 'bikepark', 'dirtpark']);
  });
  it('trail and bikepark have GPX trails', () => {
    expect(TYPES.filter(t => SPOT_CAPABILITIES[t].trails)).toEqual(['trail', 'bikepark']);
  });
  it('only trail has GPX tours', () => {
    expect(TYPES.filter(t => SPOT_CAPABILITIES[t].tours)).toEqual(['trail']);
  });
  it('trails use the trail editor, both park types the park editor', () => {
    expect(SPOT_CAPABILITIES.trail.details).toBe('trail');
    expect(SPOT_CAPABILITIES.bikepark.details).toBe('park');
    expect(SPOT_CAPABILITIES.dirtpark.details).toBe('park');
  });
  it('each park type writes its own details table', () => {
    expect(SPOT_CAPABILITIES.bikepark.detailsTable).toBe('bike_park_details');
    expect(SPOT_CAPABILITIES.dirtpark.detailsTable).toBe('dirt_park_details');
  });
  it('only dirtparks carry the pumptrack / dirt-jump kind', () => {
    expect(TYPES.filter(t => SPOT_CAPABILITIES[t].parkKind)).toEqual(['dirtpark']);
  });
  it('maps to the right tables and labels', () => {
    expect(SPOT_CAPABILITIES.bikepark).toMatchObject({ table: 'parks', label: 'Bikepark' });
    expect(SPOT_CAPABILITIES.trail.table).toBe('trails');
    expect(SPOT_CAPABILITIES.dirtpark).toMatchObject({ table: 'dirt_parks', label: 'Dirtpark' });
  });
});
