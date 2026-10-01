export type WebsiteResult = { ok: true; url: string } | { ok: false; error: string }

const MAX_LEN = 500
// Mirrors the set_spot_website RPC check.
const URL_RE = /^https?:\/\/\S+$/i

export function normalizeWebsiteUrl(raw: string | null | undefined): WebsiteResult {
  const url = (raw ?? '').trim()
  if (!url) return { ok: true, url: '' }
  if (url.length > MAX_LEN) return { ok: false, error: `Die Adresse ist zu lang (max. ${MAX_LEN} Zeichen).` }
  if (!URL_RE.test(url)) return { ok: false, error: 'Bitte eine vollständige Adresse mit http:// oder https:// angeben.' }
  return { ok: true, url }
}
