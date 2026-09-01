import { describe, it, expect } from 'vitest'
import { toSocialImage, OG_FALLBACK_IMAGE } from './socialImage'

describe('toSocialImage', () => {
  it('falls back to the static card when there is no photo', () => {
    expect(toSocialImage(undefined)).toBe(OG_FALLBACK_IMAGE)
    expect(toSocialImage(null)).toBe(OG_FALLBACK_IMAGE)
    expect(toSocialImage('')).toBe(OG_FALLBACK_IMAGE)
  })

  it('rewrites a Supabase storage object URL to the image-render endpoint with a 1200x630 JPEG crop', () => {
    const src = 'https://proj.supabase.co/storage/v1/object/public/trail-photos/abc/def.webp'
    expect(toSocialImage(src)).toBe(
      'https://proj.supabase.co/storage/v1/render/image/public/trail-photos/abc/def.webp?width=1200&height=630&resize=cover&quality=70',
    )
  })

  it('leaves a non-Supabase URL untouched', () => {
    const src = 'https://cdn.example.com/photo.jpg'
    expect(toSocialImage(src)).toBe(src)
  })
})
