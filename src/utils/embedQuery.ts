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

/**
 * Regression: for the prerendered /embed/[token] dynamic route, Nuxt's
 * client-side router rewrites window.location to its own canonical route
 * URL (bare path, no trailing slash, no query string) once it takes over —
 * this isn't a brief hydration-timing race that settles back, it's a
 * standing rewrite for the lifetime of the page. Reading
 * window.location.search at any point, including inside onMounted, can
 * observe that query-less rewritten URL instead of the query string the
 * page was actually requested with — every embed then falls back to
 * DEFAULT_LAT/DEFAULT_LNG regardless of what the iframe's src asked for.
 *
 * performance.getEntriesByType('navigation')[0] records the browser's
 * actual navigation as it happened and is never touched by subsequent
 * History API writes, so its .name reliably reflects the real request.
 */
export function getRequestedSearch(win: Window = window): string {
  const [nav] = win.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  const url = nav?.name || win.location.href
  try {
    return new URL(url).search
  } catch {
    return win.location.search
  }
}
