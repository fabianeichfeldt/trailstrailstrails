// No imports: nuxt.config.ts and build/ read this too (sitemap, redirect stubs).
export const SITE_ORIGIN = 'https://trailradar.org'

/** Path with a trailing slash — GitHub Pages 301s the slashless form, so every canonical/sitemap/link uses this one. */
export function canonicalPath(path: string): string {
  const [pathname, rest = ''] = path.split(/(?=[?#])/, 2)
  const withSlash = pathname!.endsWith('/') ? pathname! : `${pathname}/`
  return `${withSlash}${rest}`
}

/** Absolute canonical URL for a site path, always with a trailing slash. */
export function canonicalUrl(path: string): string {
  return `${SITE_ORIGIN}${canonicalPath(path.startsWith('/') ? path : `/${path}`)}`
}
