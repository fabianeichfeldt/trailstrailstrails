export interface SpotNotFoundInput {
  isRegion: boolean
  hasSpot: boolean
  isServer: boolean
  isPrerender: boolean
}

/** Soft-404 handling: noindex always; hard 404 only at prerender so no page file is written. */
export function spotNotFoundPolicy(i: SpotNotFoundInput): { noindex: boolean; fail404: boolean } {
  const missing = !i.isRegion && !i.hasSpot
  return { noindex: missing, fail404: missing && i.isServer && i.isPrerender }
}
