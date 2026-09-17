import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SingleTrail, BikePark, DirtPark, Trail } from '~/types/Trail'

// Only the columns the map actually reads: marker position + styling
// (latitude/longitude/approved), navigation (id/slug), and search/labels
// (name). `url`, `instagram`, `creator`, `creator_id`, `visible`, `spotcheck`
// and `created_at` were coming back on every map load and never used — see
// docs/db-egress-reduction-plan.md P0-2.
export const SPOT_LIST_COLUMNS = 'id,slug,name,latitude,longitude,approved'
// dirt_parks additionally carries the pumptrack/dirtpark flags that
// filtersStore.apply() branches on.
export const DIRTPARK_LIST_COLUMNS = `${SPOT_LIST_COLUMNS},pumptrack,dirtpark`

// Build a PostgREST URL exactly the way @supabase/postgrest-js does
// (`url.searchParams.set('select', columns)`), so the key we write into the
// SW runtime cache in warmSwCaches() byte-matches the request the client
// makes on a later load.
function restUrl(base: string, table: string, columns: string): string {
  const u = new URL(`${base}/rest/v1/${table}`)
  u.searchParams.set('select', columns)
  return u.toString()
}

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
  const loaded = ref(false)
  // The promise of a fetchAll() that is still running, so concurrent callers
  // of ensureLoaded() share one request instead of racing three more.
  let inFlight: Promise<void> | null = null

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const [trailsRes, parksRes, dirtRes] = await Promise.all([
        anonClient.from('trails').select(SPOT_LIST_COLUMNS),
        anonClient.from('parks').select(SPOT_LIST_COLUMNS),
        anonClient.from('dirt_parks').select(DIRTPARK_LIST_COLUMNS),
      ])
      // Rows are hydrated with only SPOT_LIST_COLUMNS — enough for every map /
      // search / filter consumer (all of which read just position, id, slug,
      // name, approved, type + the dirtpark flags). The full BaseTrail shape is
      // only ever needed on the spot-detail page, which fetches its own row.
      trails.value = (trailsRes.data ?? []).map(t => ({ ...t, type: 'trail' as const })) as unknown as SingleTrail[]
      bikeparks.value = (parksRes.data ?? []).map(p => ({ ...p, type: 'bikepark' as const })) as unknown as BikePark[]
      dirtparks.value = (dirtRes.data ?? []).map(d => ({ ...d, type: 'dirtpark' as const })) as unknown as DirtPark[]

      // If the SW wasn't controlling this page yet (first install race condition),
      // the Supabase responses above bypassed the SW and were never cached.
      // Write them into the runtime caches manually so offline works on next load.
      if (import.meta.client && 'caches' in window && !navigator.serviceWorker?.controller) {
        warmSwCaches(sbConfig.url, trailsRes.data, parksRes.data, dirtRes.data).catch(() => {})
      }
      loaded.value = true
    } catch {
      error.value = 'Trails konnten nicht geladen werden'
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetches the spot lists once, on demand.
   *
   * The landing-page searchbar loads spots lazily (on first focus / first
   * keystroke) so a visitor who never searches costs zero extra Supabase
   * egress — see docs/superpowers/specs/2026-09-17-start-page-searchbar-design.md
   * §3 and docs/db-egress-reduction-plan.md. Both entry points can fire
   * within the same tick, hence the in-flight dedupe: focus + first keystroke
   * must not trigger two fetches. A failed fetch leaves `loaded` false, so the
   * next interaction retries.
   */
  async function ensureLoaded(): Promise<void> {
    if (loaded.value) return
    if (inFlight) return inFlight
    inFlight = fetchAll().finally(() => { inFlight = null })
    return inFlight
  }

  async function warmSwCaches(
    supabaseUrl: string,
    trailsData: unknown[] | null,
    parksData: unknown[] | null,
    dirtData: unknown[] | null,
  ) {
    const entries: [string, string, unknown[] | null][] = [
      [restUrl(supabaseUrl, 'trails', SPOT_LIST_COLUMNS),        'supabase-rest-trails',    trailsData],
      [restUrl(supabaseUrl, 'parks', SPOT_LIST_COLUMNS),         'supabase-rest-parks',     parksData],
      [restUrl(supabaseUrl, 'dirt_parks', DIRTPARK_LIST_COLUMNS), 'supabase-rest-dirtparks', dirtData],
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

  return { trails, bikeparks, dirtparks, all, loading, loaded, error, fetchAll, ensureLoaded }
})
