// `ref`/`computed` are explicit imports rather than Nuxt auto-imports, the
// same way usePwaInstall.ts does it: it keeps the module self-contained under
// vitest, where there is no Nuxt to inject them.
import { computed, ref } from 'vue'
import { searchPlaces } from '~/communication/places'

// All the searchbar's behaviour: debounce, name scoring, group assembly,
// keyboard highlight and the stale-response guard. It used to live inline in
// SearchBar.vue, which made the component impossible to reuse on the landing
// page without dragging the logic along — see
// docs/superpowers/specs/2026-09-17-start-page-searchbar-design.md.
//
// Deliberately free of DOM access and of routing: the component owns the DOM
// (scroll-into-view, click-outside) and its host page owns navigation.

export interface SpotSearchItem {
  key: string
  icon: string
  name: string
  sub: string
  /** Set for a spot result — the id to open on the map. */
  trailId?: string
  /** Set for a place result — the coordinates to fly to. */
  lat?: number
  lon?: number
}

export interface SpotSearchGroup {
  label: string
  items: SpotSearchItem[]
}

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250
const MAX_SPOT_RESULTS = 5

const TYPE_ICON: Record<string, string> = { trail: '🚵️', bikepark: '🚵', dirtpark: '🚵' }
const TYPE_LABEL: Record<string, string> = { trail: 'Trail', bikepark: 'Bikepark', dirtpark: 'Dirtpark / Pumptrack' }

/** Higher is a better match; 0 means "not a match at all" and is dropped. */
function trailScore(name: string, q: string): number {
  const n = name.toLowerCase(); const qq = q.toLowerCase()
  if (n === qq) return 100
  if (n.startsWith(qq)) return 80
  if (n.includes(qq)) return 60
  if (n.split(/\s+/).some(w => w.startsWith(qq))) return 40
  return 0
}

function placeParts(displayName: string): { name: string; sub: string } {
  const p = displayName.split(', ')
  return { name: p[0] ?? displayName, sub: p.slice(1, 3).join(', ') }
}

export function useSpotSearch() {
  const trailsStore = useTrailsStore()

  const query = ref('')
  const results = ref<SpotSearchGroup[]>([])
  const noResults = ref(false)
  const selectedIndex = ref(-1)

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  // The query whose results are currently allowed to win. A slow Nominatim
  // reply for a query the user has already moved on from must not overwrite
  // newer results.
  let currentQuery = ''

  const flatResults = computed(() => results.value.flatMap(g => g.items))
  const highlightedItem = computed<SpotSearchItem | undefined>(() => flatResults.value[selectedIndex.value])

  function setResults(groups: SpotSearchGroup[]) {
    results.value = groups
    selectedIndex.value = -1
  }

  async function runSearch(q: string) {
    currentQuery = q

    // Spots are loaded lazily, so a query typed before (or instead of) a focus
    // event still has to wait for the data before it can score anything.
    await trailsStore.ensureLoaded()
    if (currentQuery !== q) return

    const all = [...trailsStore.trails, ...trailsStore.bikeparks, ...trailsStore.dirtparks]
    const matched = all
      .map(t => ({ t, score: trailScore(t.name, q) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SPOT_RESULTS)
      .map(x => x.t)

    const groups: SpotSearchGroup[] = []
    if (matched.length) {
      groups.push({
        label: 'Trails & Parks',
        items: matched.map(t => ({
          key: t.id,
          icon: TYPE_ICON[t.type] ?? '📍',
          name: t.name,
          sub: TYPE_LABEL[t.type] ?? '',
          trailId: t.id,
        })),
      })
    }
    // Show the local hits immediately; the geocoder round-trip is appended
    // below once (and if) it comes back.
    setResults(groups)
    noResults.value = false

    const places = await searchPlaces(q)
    if (currentQuery !== q) return

    if (places.length) {
      groups.push({
        label: 'Orte & Regionen',
        items: places.map((p, i) => {
          const { name, sub } = placeParts(p.display_name)
          return { key: `place-${i}`, icon: '📍', name, sub, lat: parseFloat(p.lat), lon: parseFloat(p.lon) }
        }),
      })
    }
    setResults([...groups])
    noResults.value = results.value.length === 0
  }

  function onInput() {
    clearTimeout(debounceTimer)
    if (query.value.trim().length < MIN_QUERY_LENGTH) {
      currentQuery = ''
      clearResults()
      return
    }
    debounceTimer = setTimeout(() => runSearch(query.value.trim()), DEBOUNCE_MS)
  }

  /** First focus warms the spot lists (and the SW runtime caches with them). */
  function onFocus() {
    void trailsStore.ensureLoaded()
  }

  function highlightNext() {
    const total = flatResults.value.length
    if (!total) return
    selectedIndex.value = selectedIndex.value < total - 1 ? selectedIndex.value + 1 : 0
  }

  function highlightPrev() {
    const total = flatResults.value.length
    if (!total) return
    selectedIndex.value = selectedIndex.value > 0 ? selectedIndex.value - 1 : total - 1
  }

  function highlight(item: SpotSearchItem) {
    selectedIndex.value = flatResults.value.findIndex(r => r.key === item.key)
  }

  function clearResults() {
    results.value = []
    noResults.value = false
    selectedIndex.value = -1
  }

  function clear() {
    clearTimeout(debounceTimer)
    currentQuery = ''
    query.value = ''
    clearResults()
  }

  return {
    query,
    results,
    noResults,
    selectedIndex,
    flatResults,
    highlightedItem,
    runSearch,
    onInput,
    onFocus,
    highlightNext,
    highlightPrev,
    highlight,
    clearResults,
    clear,
  }
}
