import { canonicalUrl, SITE_ORIGIN } from '~/utils/seo'
import type { SpotRegionMatch } from '~/utils/spotSummary'

const ORG = { '@id': `${SITE_ORIGIN}/#organization` }

export interface SpotJsonLdInput {
  slug: string
  name: string
  description: string
  latitude: number
  longitude: number
  image?: string
  openingHours?: string
  accessType?: 'free' | 'paid' | 'membership'
  region?: SpotRegionMatch | null
}

export interface RegionRef { slug: string; name: string }

export function buildSpotJsonLd(i: SpotJsonLdInput): Record<string, unknown> {
  const url = canonicalUrl(`/trails/${i.slug}`)
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    '@id': `${url}#place`,
    name: i.name,
    description: i.description,
    sport: 'Mountainbiking',
    geo: { '@type': 'GeoCoordinates', latitude: i.latitude, longitude: i.longitude },
    url,
    ...(i.image ? { image: i.image } : {}),
    ...(i.openingHours?.trim() ? { openingHours: i.openingHours.trim() } : {}),
    ...(i.accessType === 'free' ? { isAccessibleForFree: true } : {}),
    ...(i.accessType === 'paid' ? { isAccessibleForFree: false } : {}),
    ...(i.region
      ? { containedInPlace: { '@type': 'Place', name: regionName(i.region), url: canonicalUrl(`/trails/${i.region.slug}`) } }
      : {}),
    publisher: ORG,
    provider: ORG,
  }
}

/** "im Allgäu" -> "Allgäu"; the pronom is the only region label we have. */
function regionName(r: SpotRegionMatch): string {
  return r.pronom.replace(/^(im|in|in der|in den|am|an der|auf der)\s+/i, '')
}

function breadcrumb(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, idx) => ({ '@type': 'ListItem', position: idx + 1, name: it.name, item: it.url })),
  }
}

export function buildSpotBreadcrumb(i: { slug: string; name: string; region?: SpotRegionMatch | null }) {
  return breadcrumb([
    { name: 'Start', url: canonicalUrl('/') },
    ...(i.region ? [{ name: regionName(i.region), url: canonicalUrl(`/trails/${i.region.slug}`) }] : []),
    { name: i.name, url: canonicalUrl(`/trails/${i.slug}`) },
  ])
}
