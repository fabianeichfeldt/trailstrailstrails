import type { SupabaseClient } from '@supabase/supabase-js'

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
