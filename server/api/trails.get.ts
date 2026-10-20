import { SPOT_TYPE_LIST, tagSpots, visibleFilter } from '@@/app/types/SpotTypes'

export default defineEventHandler(async () => {
  const url = process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.NUXT_PUBLIC_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) return []

  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  const fields = 'id,slug,name,latitude,longitude,approved'

  const responses = await Promise.all(SPOT_TYPE_LIST.map(def =>
    fetch(`${url}/rest/v1/${def.table}?select=${fields}${visibleFilter(def)}`, { headers })))

  if (responses.some(r => !r.ok)) return []

  const groups = await Promise.all(responses.map(r => r.json() as Promise<any[]>))
  return SPOT_TYPE_LIST.flatMap((def, i) => tagSpots(def.type, groups[i] ?? []))
})
