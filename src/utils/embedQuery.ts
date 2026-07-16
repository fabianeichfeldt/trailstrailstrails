export interface EmbedQueryParams {
  lat: number
  lng: number
  zoom: number
  parentHost: string
}

const DEFAULT_LAT = 47.8
const DEFAULT_LNG = 13.0
const DEFAULT_ZOOM = 10

export function parseEmbedQuery(search: string): EmbedQueryParams {
  const query = new URLSearchParams(search)
  return {
    lat: parseFloat(query.get('lat') ?? '') || DEFAULT_LAT,
    lng: parseFloat(query.get('lng') ?? '') || DEFAULT_LNG,
    zoom: parseInt(query.get('zoom') ?? '') || DEFAULT_ZOOM,
    parentHost: query.get('parentHost') ?? '',
  }
}
