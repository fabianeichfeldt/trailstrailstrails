import { SPOT_TYPES, type SpotType } from '~/types/SpotTypes'
import type { RegionSpot } from '@@/build/regionSpots'

export interface SpotRegionMatch { slug: string; pronom: string }

export interface SpotSummaryInput {
  name: string
  type: SpotType
  approved?: boolean
  region?: SpotRegionMatch | null
  /** Live status; left out of meta text because the build bakes it. */
  status?: 'open' | 'limited' | 'closed' | 'unknown'
  openingHours?: string
}

const STATUS_TEXT: Record<'open' | 'limited' | 'closed', string> = {
  open: 'Aktuell geöffnet.',
  limited: 'Aktuell nur eingeschränkt befahrbar.',
  closed: 'Aktuell gesperrt.',
}

const MAX_HOURS = 140

function hoursSentence(raw?: string): string {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const cut = t.length <= MAX_HOURS ? t : `${t.slice(0, MAX_HOURS - 1).replace(/\s+\S*$/, '')}…`
  return `Öffnungszeiten / Fahrverbote: ${cut}${/[.!?…]$/.test(cut) ? '' : '.'}`
}

/** First region (smallest distance wins) whose spot list contains `slug`. */
export function findSpotRegion(
  slug: string,
  regionSpots: Record<string, RegionSpot[]>,
  regions: Record<string, { pronom: string }>,
): SpotRegionMatch | null {
  let best: { slug: string; d: number } | null = null
  for (const [rs, list] of Object.entries(regionSpots)) {
    if (!regions[rs]) continue
    const hit = list.find(s => s.slug === slug)
    if (hit && (!best || hit.distanceKm < best.d)) best = { slug: rs, d: hit.distanceKm }
  }
  return best ? { slug: best.slug, pronom: regions[best.slug]!.pronom } : null
}

/** German 1–2 sentence fact text built only from fields that are present. */
export function buildSpotSummary(input: SpotSummaryInput, opts: { includeStatus?: boolean } = {}): string {
  const label = SPOT_TYPES[input.type].eyebrow
  const official = input.approved ? 'offizieller ' : ''
  const place = input.region ? ` ${input.region.pronom}` : ''
  const parts = [`${input.name} ist ein ${official}${label}${place}.`]
  if (opts.includeStatus && input.status && input.status !== 'unknown') parts.push(STATUS_TEXT[input.status])
  const hours = hoursSentence(input.openingHours)
  if (hours) parts.push(hours)
  return parts.join(' ')
}
