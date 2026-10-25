import { canonicalUrl } from '../app/utils/seo'
import { isRegionIndexable, type RegionSpotsMap } from './regionSpots'
import type { Regions } from './region'

export const STATIC_SITEMAP_PATHS = [
  '/', '/map', '/trailradar-vs-komoot', '/trailradar-vs-trailforks', '/articles',
  '/about', '/faq', '/support', '/plans', '/business', '/how-to-embed', '/trailmanagement',
  '/impressum', '/kontakt', '/legal', '/privacy', '/terms',
]

/** Indexable URLs only, trailing-slash canonical; no lastmod/changefreq/priority (no real dates, Google ignores the rest). */
export function buildSitemapXml(opts: {
  regions: Regions
  regionSpots: RegionSpotsMap
  spotSlugs: string[]
  staticPaths?: string[]
}): string {
  const paths = [
    ...(opts.staticPaths ?? STATIC_SITEMAP_PATHS),
    ...Object.entries(opts.regions)
      .filter(([slug, r]) => isRegionIndexable(r, opts.regionSpots[slug] ?? []))
      .map(([slug]) => `/trails/${slug}`),
    ...opts.spotSlugs.map(s => `/trails/${s}`),
  ]
  const urls = paths.map(p => `  <url>\n    <loc>${canonicalUrl(p)}</loc>\n  </url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function redirectStubHtml(targetPath: string): string {
  const abs = `https://trailradar.org${targetPath}`
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Weiterleitung – Trailradar</title>
<link rel="canonical" href="${abs}">
<meta http-equiv="refresh" content="0; url=${targetPath}">
<script>location.replace(${JSON.stringify(targetPath)})</script>
</head>
<body><p>Diese Seite ist umgezogen: <a href="${targetPath}">${targetPath}</a></p></body>
</html>
`
}

/** Stub source segments must be a single safe path segment. */
export function isSafeStubFrom(from: string): boolean {
  return !!from && !from.includes('/') && !from.includes('\\') && !from.includes('..')
}

/** Cloudflare Bulk Redirects import rows (source_url,target_url,status_code; no header), slashless and slash form per stub. */
export function buildBulkRedirectRows(stubs: { from: string; to: string }[]): string[] {
  const rows: string[] = []
  for (const { from, to } of stubs) {
    if (!isSafeStubFrom(from)) continue
    const target = `https://trailradar.org/trails/${to}/`
    rows.push(`trailradar.org/trails/${from},${target},301`)
    rows.push(`trailradar.org/trails/${from}/,${target},301`)
  }
  return rows
}
