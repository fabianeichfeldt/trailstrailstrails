import type { SpotRow } from './Api'

/** Search box only appears once the list is long enough to need it. */
export const SPOT_SEARCH_MIN_SPOTS = 5

export function shouldShowSpotSearch(total: number): boolean {
  return total >= SPOT_SEARCH_MIN_SPOTS
}

/** Case-insensitive substring match on spot name; blank query returns all. */
export function filterSpots(spots: SpotRow[], query: string): SpotRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return spots
  return spots.filter(s => s.name.toLowerCase().includes(q))
}
