import { getSpotTrails, getSpotTours, getSpotDetails, getParkDetails, getSpotParking } from './Api'
import type { GpxTrailRow, GpxTourRow, SpotDetailsRow, ParkDetailsRow, ParkingRow, SpotRow } from './Api'
import { SPOT_CAPABILITIES, type ParkDetailsTable } from './spotTypes'

export interface SpotEditorData {
  trails: GpxTrailRow[]
  tours: GpxTourRow[]
  spotDetails: SpotDetailsRow | null
  parkDetails: ParkDetailsRow | null
  parkingLots: ParkingRow[]
}

// Everything the SpotManager shows for one spot, in one parallel round-trip —
// which requests run is decided by the spot type's capability row.
export async function loadSpotForEditing(spot: Pick<SpotRow, 'id' | 'type'>): Promise<SpotEditorData> {
  const { id } = spot
  const c = SPOT_CAPABILITIES[spot.type]
  const [trails, tours, spotDetails, parkDetails, parkingLots] = await Promise.all([
    c.trails ? getSpotTrails(id) : Promise.resolve([]),
    c.tours ? getSpotTours(id) : Promise.resolve([]),
    c.details === 'trail' ? getSpotDetails(id) : Promise.resolve(null),
    c.details === 'park' ? getParkDetails(c.detailsTable as ParkDetailsTable, id) : Promise.resolve(null),
    getSpotParking(id),
  ])
  return { trails, tours, spotDetails, parkDetails, parkingLots }
}

/**
 * Latest-wins wrapper: load() resolves null when a newer load() or cancel()
 * superseded it (its data or error belongs to a spot no longer on screen).
 */
export function createSpotEditorLoader() {
  let seq = 0
  return {
    async load(spot: Pick<SpotRow, 'id' | 'type'>): Promise<SpotEditorData | null> {
      const mine = ++seq
      try {
        const data = await loadSpotForEditing(spot)
        return mine === seq ? data : null
      } catch (e) {
        if (mine !== seq) return null
        throw e
      }
    },
    cancel() { seq++ },
  }
}
