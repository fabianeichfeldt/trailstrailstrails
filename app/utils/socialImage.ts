// Link-preview crawlers (WhatsApp in particular) won't render WebP and drop
// oversized images. Trail photos are stored as WebP in Supabase Storage, so
// for og:image / twitter:image we route them through Supabase's image-render
// endpoint, which returns a right-sized JPEG. Anything that isn't a Supabase
// public-object URL (or a missing photo) falls back to the static card.

export const OG_FALLBACK_IMAGE = 'https://trailradar.org/assets/og-default.jpg'

// 1200x630 is the standard OG card size; `resize=cover` crops to fill it so
// the output dimensions are fixed and the og:image:width/height hints hold.
const RENDER_QUERY = 'width=1200&height=630&resize=cover&quality=70'

export function toSocialImage(photoUrl: string | undefined | null): string {
  if (!photoUrl) return OG_FALLBACK_IMAGE
  const marker = '/storage/v1/object/public/'
  if (photoUrl.includes(marker)) {
    return `${photoUrl.replace(marker, '/storage/v1/render/image/public/')}?${RENDER_QUERY}`
  }
  return photoUrl
}
