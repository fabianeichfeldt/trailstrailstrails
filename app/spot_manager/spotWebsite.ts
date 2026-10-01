// Mirrors the validation in the set_spot_website RPC.
export type WebsiteResult = { ok: true; value: string } | { ok: false; error: string }

export function normalizeWebsiteUrl(input: string | null | undefined): WebsiteResult {
  const v = (input ?? '').trim()
  if (v === '') return { ok: true, value: '' }
  if (v.length > 500) return { ok: false, error: 'Die Adresse ist zu lang (max. 500 Zeichen).' }
  if (!/^https?:\/\/\S+$/i.test(v)) return { ok: false, error: 'Bitte eine Adresse mit http:// oder https:// angeben.' }
  return { ok: true, value: v }
}
