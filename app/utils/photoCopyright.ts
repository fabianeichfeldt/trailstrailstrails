// Must match the CHECK constraint in the add_trail_photo_copyright migration.
export const COPYRIGHT_MAX_LENGTH = 100

// The overlay renders its own "©", so a typed one is stripped to avoid "© © Max".
export function normalizeCopyright(input: string | null | undefined): string | null {
  const text = (input ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(©|\(c\))\s*/i, '')
    .slice(0, COPYRIGHT_MAX_LENGTH)
    .trim()
  return text || null
}
