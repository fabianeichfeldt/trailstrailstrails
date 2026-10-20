// The one place that knows what a spot type is. No imports: also bundled into
// the separately-deployed /_embed Cloudflare Worker via `@@/app/types/SpotTypes`.
// A new spot type = one row here (+ its interface in Trail.ts).
export type SpotType = 'trail' | 'bikepark' | 'dirtpark'

export interface SpotTypeDef {
  type: SpotType
  table: 'trails' | 'parks' | 'dirt_parks'            // base row (list + resolve)
  visibleOnly: boolean                                // base table has a `visible` flag that hides rows
  extraListColumns: string                            // columns beyond the common list columns
  label: string                                       // short badge (SpotManager picker)
  eyebrow: string                                     // spot-detail hero eyebrow
  detailsTable: 'trail_details' | 'bike_park_details' | 'dirt_park_details'
  detailsIdColumn: 'trail_id' | 'id'
  detailsColumns: string                              // details columns the spot page reads
  detailsKind: 'trail' | 'park'                       // which SpotManager details editor
  detailsEndpoint: { path: string; param: string }    // edge function behind getTrailDetails()
  addEndpoint: string                                 // edge function that creates a spot
  gpx: { trails: boolean; tours: boolean }            // GPX sections the type has
  markerCategory: string | null                       // null = verified/unverified by `approved`
  filterKey: 'showTrails' | 'showBikeparks' | 'showDirtparks'
  pumptrackFilterKey: 'showPumptracks' | null         // used instead when the row has pumptrack=true
  parkKind: boolean                                   // pumptrack / dirt-jump flags on the base row
  manageable: boolean                                 // listed in the SpotManager picker
}

// Keep TRAIL_DETAILS_BAKED_COLUMNS in sync with bakedTrailDetails().
const TRAIL_DETAILS_BAKED_COLUMNS =
  'trail_id,rules,last_update,trail_description,status,status_until,status_hint,' +
  'access_type,donation_url,seasonal_from,seasonal_to,rain_policy,rain_closed_hours'
const PARK_DETAILS_COLUMNS = 'status,status_hint,opening_hours,rules,trail_description,last_update'

export const SPOT_TYPES: Record<SpotType, SpotTypeDef> = {
  trail: {
    type: 'trail', table: 'trails', visibleOnly: true, extraListColumns: '',
    label: 'Trail', eyebrow: 'Trail',
    detailsTable: 'trail_details', detailsIdColumn: 'trail_id',
    detailsColumns: TRAIL_DETAILS_BAKED_COLUMNS, detailsKind: 'trail',
    detailsEndpoint: { path: 'trail-details', param: 'trail' },
    addEndpoint: 'add-trail',
    gpx: { trails: true, tours: true },
    markerCategory: null, filterKey: 'showTrails', pumptrackFilterKey: null,
    parkKind: false, manageable: true,
  },
  bikepark: {
    type: 'bikepark', table: 'parks', visibleOnly: false, extraListColumns: '',
    label: 'Bikepark', eyebrow: 'Bikepark',
    detailsTable: 'bike_park_details', detailsIdColumn: 'id',
    detailsColumns: PARK_DETAILS_COLUMNS, detailsKind: 'park',
    detailsEndpoint: { path: 'bike-parks-details', param: 'id' },
    addEndpoint: 'bike-parks',
    gpx: { trails: true, tours: false },
    markerCategory: 'bikepark', filterKey: 'showBikeparks', pumptrackFilterKey: null,
    parkKind: false, manageable: true,
  },
  dirtpark: {
    type: 'dirtpark', table: 'dirt_parks', visibleOnly: false, extraListColumns: 'pumptrack,dirtpark',
    label: 'Dirtpark', eyebrow: 'Dirtpark / Pumptrack',
    detailsTable: 'dirt_park_details', detailsIdColumn: 'id',
    detailsColumns: PARK_DETAILS_COLUMNS, detailsKind: 'park',
    detailsEndpoint: { path: 'dirt-parks-details', param: 'id' },
    addEndpoint: 'dirt-parks',
    gpx: { trails: false, tours: false },
    markerCategory: 'dirtpark', filterKey: 'showDirtparks', pumptrackFilterKey: 'showPumptracks',
    parkKind: true, manageable: true,
  },
}

// Registry order is resolution/precedence order (trail wins a slug clash).
export const SPOT_TYPE_LIST: SpotTypeDef[] = Object.values(SPOT_TYPES)

export function isSpotType(type: string): type is SpotType {
  return Object.prototype.hasOwnProperty.call(SPOT_TYPES, type)
}

// Rows from a type's base table, tagged with the type — shared by every list fetch.
export function tagSpots<T extends object>(type: SpotType, rows: T[]): Array<T & { type: SpotType }> {
  return rows.map(r => ({ ...r, type }))
}

// `&visible=eq.true`-style PostgREST filter for tables that hide rows.
export function visibleFilter(def: SpotTypeDef): string {
  return def.visibleOnly ? '&visible=eq.true' : ''
}
