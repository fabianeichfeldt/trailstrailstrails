import type { anyTrailType } from '../types/Trail';

export interface SpotCapability {
  manageable: boolean                     // listed in the SpotManager picker
  gpx: boolean                            // Touren / Trails / segment editor
  details: 'trail' | 'bikepark' | null    // which Spot-Details editor
  table: 'trails' | 'parks' | 'dirt_parks'
  label: string                           // picker badge, German
}

// Open/closed: a new spot type is a new entry, not a new `type ===` branch.
export const SPOT_CAPABILITIES: Record<anyTrailType, SpotCapability> = {
  trail:    { manageable: true,  gpx: true,  details: 'trail',    table: 'trails',     label: 'Trail' },
  bikepark: { manageable: true,  gpx: false, details: 'bikepark', table: 'parks',      label: 'Bikepark' },
  dirtpark: { manageable: false, gpx: false, details: null,       table: 'dirt_parks', label: 'Dirtpark' },
};
