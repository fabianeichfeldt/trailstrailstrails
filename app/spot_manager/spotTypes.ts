import { SPOT_GPX_SECTIONS, type anyTrailType } from '../types/Trail';

export interface SpotCapability {
  manageable: boolean                     // listed in the SpotManager picker
  trails: boolean                         // Trails section (GPX upload/edit)
  tours: boolean                          // Touren section + segment editor
  details: 'trail' | 'bikepark' | null    // which Spot-Details editor
  table: 'trails' | 'parks' | 'dirt_parks'
  label: string                           // picker badge, German
}

// Open/closed: a new spot type is a new entry, not a new `type ===` branch.
export const SPOT_CAPABILITIES: Record<anyTrailType, SpotCapability> = {
  trail:    { manageable: true,  ...SPOT_GPX_SECTIONS.trail,    details: 'trail',    table: 'trails',     label: 'Trail' },
  bikepark: { manageable: true,  ...SPOT_GPX_SECTIONS.bikepark, details: 'bikepark', table: 'parks',      label: 'Bikepark' },
  dirtpark: { manageable: false, ...SPOT_GPX_SECTIONS.dirtpark, details: null,       table: 'dirt_parks', label: 'Dirtpark' },
};
