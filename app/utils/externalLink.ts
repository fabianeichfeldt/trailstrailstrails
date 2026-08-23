// Decides whether a clicked link should be handed off to the system browser
// instead of navigating the app's own WebView — see capacitor.client.ts's
// global click interceptor. Returns the absolute URL to open externally, or
// null when the link should be left alone to navigate in-app (or isn't a
// navigable link at all).
export function resolveExternalLinkUrl(href: string | null, currentHref: string): string | null {
  if (!href || href.startsWith('#')) return null

  let url: URL
  try {
    url = new URL(href, currentHref)
  } catch {
    return null
  }

  if (url.origin === new URL(currentHref).origin) return null
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  return url.href
}
