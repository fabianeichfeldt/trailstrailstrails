import type { anyTrailType } from '../types/Trail';

// New spot type = new entry; consumers read capabilities, never `type ===` chains.
export const SPOT_CAPABILITIES: Record<anyTrailType, {
  manageable: boolean                     // listed in the SpotManager picker
  gpx: boolean                            // Touren / Trails / segment editor
  details: 'trail' | 'bikepark' | null    // which Spot-Details editor
  table: 'trails' | 'parks' | 'dirt_parks'
  label: string                           // picker badge
}> = {
  trail:    { manageable: true,  gpx: true,  details: 'trail',    table: 'trails',     label: 'Trail' },
  bikepark: { manageable: true,  gpx: false, details: 'bikepark', table: 'parks',      label: 'Bikepark' },
  dirtpark: { manageable: false, gpx: false, details: null,       table: 'dirt_parks', label: 'Dirtpark' },
};
