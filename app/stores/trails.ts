import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SingleTrail, BikePark, DirtPark, Trail } from '~/types/Trail'

export const useTrailsStore = defineStore('trails', () => {
  const client = useSupabaseClient() as SupabaseClient

  // Anon-only client for public tables — parks/dirt_parks have no RLS policy for
  // the authenticated role, so the session client returns 0 rows when logged in.
  const { public: { supabase: sbConfig } } = useRuntimeConfig()
  const anonClient = createClient(sbConfig.url, sbConfig.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as SupabaseClient

  const trails = ref<SingleTrail[]>([])
  const bikeparks = ref<BikePark[]>([])
  const dirtparks = ref<DirtPark[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const [trailsRes, parksRes, dirtRes] = await Promise.all([
        anonClient.from('trails').select('*'),
        anonClient.from('parks').select('*'),
        anonClient.from('dirt_parks').select('*'),
      ])
      trails.value = (trailsRes.data ?? []).map(t => ({ ...t, type: 'trail' as const }))
      bikeparks.value = (parksRes.data ?? []).map(p => ({ ...p, type: 'bikepark' as const }))
      dirtparks.value = (dirtRes.data ?? []).map(d => ({ ...d, type: 'dirtpark' as const }))

      // If the SW wasn't controlling this page yet (first install race condition),
      // the Supabase responses above bypassed the SW and were never cached.
      // Write them into the runtime caches manually so offline works on next load.
      if (import.meta.client && 'caches' in window && !navigator.serviceWorker?.controller) {
        warmSwCaches(sbConfig.url, trailsRes.data, parksRes.data, dirtRes.data).catch(() => {})
      }
    } catch {
      error.value = 'Trails konnten nicht geladen werden'
    } finally {
      loading.value = false
    }
  }

  async function warmSwCaches(
    supabaseUrl: string,
    trailsData: unknown[] | null,
    parksData: unknown[] | null,
    dirtData: unknown[] | null,
  ) {
    const base = `${supabaseUrl}/rest/v1`
    const entries: [string, string, unknown[] | null][] = [
      [`${base}/trails?select=*`,     'supabase-rest-trails',    trailsData],
      [`${base}/parks?select=*`,      'supabase-rest-parks',     parksData],
      [`${base}/dirt_parks?select=*`, 'supabase-rest-dirtparks', dirtData],
    ]
    await Promise.all(entries.map(async ([url, cacheName, data]) => {
      if (!data) return
      const cache = await caches.open(cacheName)
      const existing = await cache.match(url)
      if (existing) return
      await cache.put(url, new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    }))
  }

  // All trail types combined — used by the map for marker rendering
  const all = computed<Trail[]>(() => [
    ...trails.value,
    ...bikeparks.value,
    ...dirtparks.value,
  ])

  return { trails, bikeparks, dirtparks, all, loading, error, fetchAll }
})
