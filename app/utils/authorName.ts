export const DELETED_USER = 'Gelöschter Nutzer'

// PostgREST embeds `profiles: null` once the author's account is gone (FK SET NULL);
// `undefined` means the payload never selected it (baked photos), so that isn't "deleted".
export function authorName(profiles: { display_name?: string | null } | null | undefined, fallback = ''): string {
  if (profiles === null) return DELETED_USER
  return profiles?.display_name || fallback
}
