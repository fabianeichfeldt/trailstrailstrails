import type { anyTrailType } from '~/types/Trail'

// Open/closed like DETAIL_ENDPOINT: a new spot type is a new entry here.
export const SPOT_CAPABILITIES: Record<anyTrailType, {
  manageable: boolean
  gpx: boolean
  details: 'trail' | 'bikepark' | null
  table: 'trails' | 'parks' | 'dirt_parks'
  label: string
}> = {
  trail:    { manageable: true,  gpx: true,  details: 'trail',    table: 'trails',     label: 'Trail' },
  bikepark: { manageable: true,  gpx: false, details: 'bikepark', table: 'parks',      label: 'Bikepark' },
  dirtpark: { manageable: false, gpx: false, details: null,       table: 'dirt_parks', label: 'Dirtpark' },
}
