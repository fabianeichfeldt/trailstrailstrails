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
