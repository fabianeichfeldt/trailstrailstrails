// Mirrors the set_spot_website RPC's validation so the editor fails before the round trip.
export const WEBSITE_MAX_LENGTH = 500;

/** Trims; '' clears the website. Throws on anything the RPC would reject. */
export function normalizeWebsiteUrl(input: string): string {
  const url = input.trim();
  if (url === '') return '';
  if (!/^https?:\/\/\S+$/i.test(url)) throw new Error('Bitte eine gültige Adresse mit http:// oder https:// angeben.');
  if (url.length > WEBSITE_MAX_LENGTH) throw new Error(`Die Adresse darf höchstens ${WEBSITE_MAX_LENGTH} Zeichen lang sein.`);
  return url;
}
