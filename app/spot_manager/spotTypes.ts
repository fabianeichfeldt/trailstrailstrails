import { SPOT_GPX_SECTIONS, type anyTrailType } from '../types/Trail';

export type ParkDetailsTable = 'bike_park_details' | 'dirt_park_details';

export interface SpotCapability {
  manageable: boolean                     // listed in the SpotManager picker
  trails: boolean                         // Trails section (GPX upload/edit)
  tours: boolean                          // Touren section + segment editor
  details: 'trail' | 'park' | null        // which Spot-Details editor
  detailsTable: 'trail_details' | ParkDetailsTable
  parkKind: boolean                       // pumptrack / dirt-jump flags on the base row
  table: 'trails' | 'parks' | 'dirt_parks'
  label: string                           // picker badge, German
}

// Open/closed: a new spot type is a new entry, not a new `type ===` branch.
export const SPOT_CAPABILITIES: Record<anyTrailType, SpotCapability> = {
  trail:    { manageable: true, ...SPOT_GPX_SECTIONS.trail,    details: 'trail', detailsTable: 'trail_details',     parkKind: false, table: 'trails',     label: 'Trail' },
  bikepark: { manageable: true, ...SPOT_GPX_SECTIONS.bikepark, details: 'park',  detailsTable: 'bike_park_details', parkKind: false, table: 'parks',      label: 'Bikepark' },
  dirtpark: { manageable: true, ...SPOT_GPX_SECTIONS.dirtpark, details: 'park',  detailsTable: 'dirt_park_details', parkKind: true,  table: 'dirt_parks', label: 'Dirtpark' },
};
