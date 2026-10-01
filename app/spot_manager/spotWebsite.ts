export type WebsiteUrlResult = { ok: true; url: string } | { ok: false; error: string };

// Mirrors the set_spot_website RPC validation; never prepends a scheme.
export function normalizeWebsiteUrl(input: string): WebsiteUrlResult {
  const url = input.trim();
  if (url === '') return { ok: true, url: '' };
  if (url.length > 500) return { ok: false, error: 'Die Adresse ist zu lang (max. 500 Zeichen).' };
  if (!/^https?:\/\/\S+$/i.test(url)) return { ok: false, error: 'Bitte eine Adresse mit http:// oder https:// angeben.' };
  return { ok: true, url };
}
