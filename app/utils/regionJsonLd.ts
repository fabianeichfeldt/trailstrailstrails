import { canonicalUrl } from '~/utils/seo'
import type { RegionSpot } from '@@/build/regionSpots'

export function buildRegionBreadcrumb(slug: string, pronom: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Start', item: canonicalUrl('/') },
      { '@type': 'ListItem', position: 2, name: `Trails ${pronom}`, item: canonicalUrl(`/trails/${slug}`) },
    ],
  }
}

export function buildRegionItemList(pronom: string, spots: RegionSpot[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Offizielle MTB Trails ${pronom}`,
    itemListElement: spots.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: canonicalUrl(`/trails/${s.slug}`),
      name: s.name,
    })),
  }
}

/** Mirrors build/regionSpots isRegionIndexable: a region needs text or spots to be worth indexing. */
export function isRegionThin(region: { descr?: string }, spots: RegionSpot[]): boolean {
  return !region.descr && spots.length === 0
}

/** Truthful count sentence: "official" only for approved spots. */
export function regionCountSentence(pronom: string, spots: RegionSpot[]): string {
  const total = spots.length
  const official = spots.filter(s => s.approved).length
  if (total === 0) return ''
  const one = total === 1
  if (official === total) return `${total} ${one ? 'offizieller' : 'offizielle'} MTB-Spot${one ? '' : 's'} ${pronom}`
  const base = `${total} MTB-Spot${one ? '' : 's'} ${pronom}`
  return official === 0 ? base : `${base}, davon ${official} offiziell`
}
