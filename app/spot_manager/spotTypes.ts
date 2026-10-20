import { SPOT_TYPES, type SpotType, type SpotTypeDef } from '../types/SpotTypes';

export type ParkDetailsTable = Exclude<SpotTypeDef['detailsTable'], 'trail_details'>;

export interface SpotCapability {
  manageable: boolean                     // listed in the SpotManager picker
  trails: boolean                         // Trails section (GPX upload/edit)
  tours: boolean                          // Touren section + segment editor
  details: 'trail' | 'park' | null        // which Spot-Details editor
  detailsTable: SpotTypeDef['detailsTable']
  parkKind: boolean                       // pumptrack / dirt-jump flags on the base row
  table: SpotTypeDef['table']
  label: string                           // picker badge, German
}

// Derived from the SPOT_TYPES registry — a new spot type is a registry row, not an edit here.
export const SPOT_CAPABILITIES = Object.fromEntries(
  Object.values(SPOT_TYPES).map(d => [d.type, {
    manageable: d.manageable, ...d.gpx, details: d.detailsKind, detailsTable: d.detailsTable,
    parkKind: d.parkKind, table: d.table, label: d.label,
  } satisfies SpotCapability]),
) as Record<SpotType, SpotCapability>;
