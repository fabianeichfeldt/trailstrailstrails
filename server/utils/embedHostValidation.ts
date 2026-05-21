/**
 * Extracts the hostname from an Origin or Referer header value.
 * Returns null if the header is absent or unparseable.
 */
export function extractHostname(header: string | null | undefined): string | null {
  if (!header) return null
  try {
    return new URL(header).hostname
  } catch {
    return null
  }
}

/**
 * Returns true when `hostname` is allowed by the `allowedHosts` list.
 * An empty allowedHosts list blocks all hosts.
 */
export function isHostAllowed(hostname: string | null, allowedHosts: string[]): boolean {
  if (!hostname) return false
  return allowedHosts.some(h => h === hostname)
}

/**
 * Resolves the effective hostname for embed authorization.
 *
 * parentHost (set by embed.js / the slug page from window.location.hostname of the
 * parent page) is authoritative when present — it tells us which site is actually
 * embedding the map.  Origin/Referer are same-origin headers from the iframe server
 * itself (trailradar.app), not from the parent page, so they can only act as a
 * fallback for direct/dev access.
 */
export function resolveHostname(
  parentHost: string | null,
  origin: string | null | undefined,
  referer: string | null | undefined,
): string | null {
  return parentHost ?? extractHostname(origin) ?? extractHostname(referer)
}
