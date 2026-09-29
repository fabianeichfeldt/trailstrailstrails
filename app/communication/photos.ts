import type { SupabaseClient } from '@supabase/supabase-js'
import { REST, userHeaders } from './http'
import type { IAuthService } from '../auth/auth_service'

async function transformImage(file: File, maxWidth = 1000, quality = 0.8): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = URL.createObjectURL(file)
  })

  const scale = Math.min(1, maxWidth / img.width)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/webp', quality))
}

export async function uploadTrailPhoto(
  file: File,
  trailId: string,
  client: SupabaseClient,
  userId: string,
): Promise<string> {
  const filePath = `${trailId}/${crypto.randomUUID()}.webp`
  const resized = await transformImage(file, 1000, 0.8)

  const { error } = await client.storage
    .from('trail-photos')
    .upload(filePath, resized, { cacheControl: '86400', upsert: false, contentType: 'image/webp' })
  if (error) throw new Error('Photo upload failed')

  const { data } = client.storage.from('trail-photos').getPublicUrl(filePath)

  const { error: dbError } = await client.from('trail_photos').insert({
    trail_id: trailId,
    url:      data.publicUrl,
    creator:  userId,
  })
  if (dbError) throw new Error('Photo record insert failed')

  return data.publicUrl
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
