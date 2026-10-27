import type { SupabaseClient } from '@supabase/supabase-js'
import { REST, userHeaders } from './http'
import type { IAuthService } from '../auth/auth_service'
import { normalizeCopyright } from '../utils/photoCopyright'

interface EncodedImage { blob: Blob; ext: 'webp' | 'jpg'; contentType: 'image/webp' | 'image/jpeg' }

async function transformImage(file: File, maxWidth: number, maxHeight: number, quality = 0.8): Promise<EncodedImage> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = URL.createObjectURL(file)
  })

  // Height cap too: phone portraits would otherwise land at 1000×1778.
  const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
  const encode = (type: string) => new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), type, quality))

  const webp = await encode('image/webp')
  if (webp.type === 'image/webp') return { blob: webp, ext: 'webp', contentType: 'image/webp' }
  // iOS Safari can't encode WebP and silently hands back a multi-MB PNG instead.
  return { blob: await encode('image/jpeg'), ext: 'jpg', contentType: 'image/jpeg' }
}

export async function uploadTrailPhoto(
  file: File,
  trailId: string,
  client: SupabaseClient,
  userId: string,
  copyright?: string | null,
): Promise<string> {
  // The carousel crops to fill its width, so portraits keep enough width to stay sharp.
  const { blob, ext, contentType } = await transformImage(file, 1000, 1400)
  const filePath = `${trailId}/${crypto.randomUUID()}.${ext}`

  // Paths are unique per upload and never overwritten, so the file can be cached for a year.
  const { error } = await client.storage
    .from('trail-photos')
    .upload(filePath, blob, { cacheControl: '31536000', upsert: false, contentType })
  if (error) throw new Error('Photo upload failed')

  const { data } = client.storage.from('trail-photos').getPublicUrl(filePath)

  const { error: dbError } = await client.from('trail_photos').insert({
    trail_id: trailId,
    url:      data.publicUrl,
    creator:  userId,
    copyright: normalizeCopyright(copyright),
  })
  if (dbError) throw new Error('Photo record insert failed')

  return data.publicUrl
}

export async function uploadAvatar(file: File, userId: string, client: SupabaseClient): Promise<string> {
  const { blob, ext, contentType } = await transformImage(file, 256, 256)
  const filePath = `${userId}/avatar.${ext}`
  const { error } = await client.storage
    .from('avatars')
    .upload(filePath, blob, { cacheControl: '3600', upsert: true, contentType })
  if (error) throw new Error('Avatar upload failed')
  return client.storage.from('avatars').getPublicUrl(filePath).data.publicUrl
}

export async function deletePhoto(
  photo: { id: string | number; url: string },
  client: SupabaseClient,
): Promise<void> {
  const { data, error } = await client
    .from('trail_photos')
    .delete()
    .eq('id', photo.id)
    .select('id')
  if (error) throw new Error('Photo delete failed')
  if (!data || data.length === 0) throw new Error('Photo delete failed: not permitted')

  const path = photo.url.split('/trail-photos/')[1]
  if (!path) return
  const { error: storageError } = await client.storage.from('trail-photos').remove([path])
  if (storageError) throw new Error('Photo file delete failed')
}

// RLS + a column grant limit this to the uploader's own row and the copyright column.
export async function updatePhotoCopyright(
  photoId: string | number,
  copyright: string | null,
  client: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await client
    .from('trail_photos')
    .update({ copyright: normalizeCopyright(copyright) })
    .eq('id', photoId)
    .select('id, copyright')
  if (error) throw new Error('Copyright update failed')
  if (!data || data.length === 0) throw new Error('Copyright update failed: not permitted')
  return data[0]?.copyright ?? null
}

// Precise trailcrew-assignment check (not "is trailcrew at all") — used to
// gate the photo-delete control's visibility. Plain authenticated REST read
// against trailcrew_spots, same IAuthService + REST style as
// comments.ts's deleteComment, since this is a table read, not a Storage
// operation (deletePhoto above stays on the SupabaseClient style that
// uploadTrailPhoto already established for this file).
export async function isSpotAssignedToTrailcrew(spotId: string, authService: IAuthService): Promise<boolean> {
  const user = await authService.getUser()
  const res = await fetch(
    `${REST}/trailcrew_spots?select=spot_id&user_id=eq.${user.id}&spot_id=eq.${spotId}&limit=1`,
    { method: 'GET', cache: 'no-store', headers: userHeaders(user.accessToken) },
  )
  if (!res.ok) return false
  const rows = await res.json()
  return Array.isArray(rows) && rows.length > 0
}
