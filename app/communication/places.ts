// Place / region lookup via OpenStreetMap's Nominatim geocoder.
//
// This used to be a raw `fetch()` inside SearchBar.vue. The searchbar is now
// rendered on two pages (the map and the landing-page teaser), and the
// documented layering puts every outbound request in `communication/` — see
// CLAUDE.md "Architecture". No Supabase involved, so no `REST`/`anonHeaders()`
// here; Nominatim is a third-party public API.

/** The subset of a Nominatim search result the searchbar actually reads. */
export interface Place {
  display_name: string
  lat: string
  lon: string
}

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
// Trailradar's spots sit almost exclusively in DACH, so "Freiburg" must
// resolve to the German one rather than the one in Wisconsin. Only when the
// DACH query comes back empty do we widen the search to the whole world.
const DACH_COUNTRY_CODES = 'de,at,ch'

/**
 * Searches Nominatim for `q`, DACH first and worldwide as a fallback.
 * Never throws — a failing geocoder degrades to "no place results" so the
 * local spot results still show.
 */
export async function searchPlaces(q: string): Promise<Place[]> {
  const base = `${NOMINATIM_SEARCH}?format=json&accept-language=de&limit=5&q=${encodeURIComponent(q)}`
  try {
    const dach = await getPlaces(`${base}&countrycodes=${DACH_COUNTRY_CODES}`)
    if (dach.length) return dach
    return await getPlaces(base)
  } catch {
    return []
  }
}

async function getPlaces(url: string): Promise<Place[]> {
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? (data as Place[]) : []
}
