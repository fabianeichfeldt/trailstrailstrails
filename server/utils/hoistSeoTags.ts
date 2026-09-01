// Crawlers with a small fetch budget — WhatsApp's link-preview bot in
// particular — only parse the first slice of <head>. Nuxt's `inlineStyles`
// injects tens of KB of component CSS ahead of the SEO / Open Graph tags
// that useSeoMeta emits, pushing title/description/og:*/twitter:* past that
// budget, so a shared trail link renders with no preview at all.
//
// hoistSeoTags() pulls the discovery-critical tags back to the front of
// <head>, before the style blocks. It runs at prerender time (see
// server/plugins/hoist-seo-head.ts), so the reordering is baked into the
// static HTML with zero runtime cost and no effect on the CSS inlining that
// LCP depends on.

const RANK: [RegExp, number][] = [
  [/^<meta[^>]*\bcharset=/i, 0],
  [/^<meta[^>]*\bname="viewport"/i, 1],
  [/^<title[\s>]/i, 2],
  [/^<meta[^>]*\bname="description"/i, 3],
  [/^<meta[^>]*\bproperty="og:title"/i, 4],
  [/^<meta[^>]*\bproperty="og:description"/i, 5],
  [/^<meta[^>]*\bproperty="og:image/i, 6],
  [/^<meta[^>]*\bproperty="og:/i, 7],
  [/^<meta[^>]*\bname="twitter:/i, 8],
  [/^<link[^>]*\brel="canonical"/i, 9],
]

export function seoTagRank(tag: string): number {
  for (const [re, rank] of RANK) {
    if (re.test(tag)) return rank
  }
  return Infinity
}

const TAG_RE = /<title[^>]*>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*>/gi

// Takes Nitro's `html.head` chunks, returns a new single-chunk array with
// the SEO-critical tags moved to the front (in a stable, crawler-friendly
// order) and everything else left in place.
export function hoistSeoTags(head: string[]): string[] {
  const joined = head.join('')
  const hoisted: string[] = []
  const rest = joined.replace(TAG_RE, (match) => {
    if (seoTagRank(match) !== Infinity) {
      hoisted.push(match)
      return ''
    }
    return match
  })
  if (hoisted.length === 0) return head
  hoisted.sort((a, b) => seoTagRank(a) - seoTagRank(b))
  return [hoisted.join('') + rest]
}
