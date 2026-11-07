// Leaflet-free decision for a map click while the add-spot FAB is armed.

export interface AddClickDeps<T> {
  /** Armed spot type; undefined = not in add mode. */
  mode: string | undefined
  latlng: { lat: number; lng: number }
  findNearby: (lat: number, lng: number) => T | null | undefined
  /** Resolves true when the user wants to add the spot despite the nearby one. */
  askConflict: (nearby: T) => Promise<boolean>
}

export type AddClickResult = { lat: number; lng: number; type: string } | null

/** The picked spot, or null when not in add mode or the user backed out of a nearby conflict. */
export async function resolveAddClick<T>(d: AddClickDeps<T>): Promise<AddClickResult> {
  if (!d.mode) return null
  const nearby = d.findNearby(d.latlng.lat, d.latlng.lng)
  const proceed = nearby ? await d.askConflict(nearby) : true
  return proceed ? { lat: d.latlng.lat, lng: d.latlng.lng, type: d.mode } : null
}
