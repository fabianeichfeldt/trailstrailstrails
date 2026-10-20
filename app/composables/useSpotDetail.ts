import { getTrailById, getTrailBySlug, getTrailDetails } from '~/communication/trails'
import { bakedTrailDetails } from '~/utils/bakedTrailDetails'
import { TrailDetails } from '~/types/TrailDetails'
import type { Trail } from '~/types/Trail'
import { useAuthService } from './useAuthService'

/**
 * Everything the spot-detail page (trails/[slug].vue) loads for one spot:
 * resolves the slug (301-ing a legacy id URL to its slug), refreshes the
 * SSG-baked payload after mount, then kicks off the live per-spot loads
 * (GPX, parking, comments, photo moderation, details + likes) with stale
 * guards so a late answer for a previous spot never lands on the current one.
 *
 * Pass `null` (region pages) to skip everything. The live loads only start
 * after mount — never during SSR/prerender, which would freeze them into the
 * static HTML.
 */
export async function useSpotDetail(slug: string | null) {
  // Region pages: no fetch and no payload key shared by every region page.
  if (!slug) {
    return {
      trail: ref(null),
      spot: computed<Trail | null>(() => null),
      details: ref(new TrailDetails('')),
      refreshDetails: async () => {},
      removePhoto: (_id: string) => {},
    }
  }

  const spotPanel = useSpotPanelStore()
  const authStore = useAuthStore()
  const authService = useAuthService()

  // Trust the SSR payload for hydration (default getCachedData): a forced
  // client refetch here causes a spurious hydration mismatch; the live
  // refresh happens in onMounted below. Awaited only at the end — lifecycle
  // hooks must register before the first await or they attach to nothing.
  const key = `trail-${slug}`
  const asyncData = useAsyncData(key, async () => {
    try {
      const bySlug = await getTrailBySlug(slug)
      if (bySlug) return bySlug

      // Legacy /trails/<id>/ URL: edge redirect stubs cover crawlers; this
      // covers ids too new to have a stub and direct in-app navigation.
      const byId = await getTrailById(slug)
      if (byId?.slug && byId.slug !== slug) {
        await navigateTo(`/trails/${byId.slug}/`, { redirectCode: 301, replace: true })
      }
      return byId
    } catch {
      return null
    }
  })
  const { data: trail, refresh } = asyncData

  // getTrailById/BySlug merge base row + details row + type + photos — the
  // Trail shape the section components and spotPanel store expect.
  const spot = computed<Trail | null>(() => (trail.value as unknown as Trail | null) ?? null)

  // Seeded from the baked payload so content renders immediately (SEO-safe);
  // refreshDetails() swaps in the live row (status hint freshness, likes).
  const details = ref<TrailDetails>(bakedTrailDetails(trail.value))

  async function refreshDetails() {
    const item = spot.value
    if (!item) return
    try {
      const d = await getTrailDetails(item)
      if (spot.value?.id !== item.id) return // spot moved on while the fetch was in flight
      spotPanel.applyLikes(d.likes, authStore.userId)
      details.value = d
    } catch (e) {
      console.warn('Failed to refresh live trail details, keeping prerendered content:', e)
    }
  }

  function removePhoto(id: string) {
    details.value.photos = details.value.photos.filter(p => p.id !== id)
  }

  // The mount refresh and the id watcher can both fire for the same spot —
  // start each spot once.
  let startedFor: string | null = null
  function start(item: Trail) {
    if (startedFor === item.id) return
    startedFor = item.id
    details.value = bakedTrailDetails(trail.value)
    spotPanel.load(item)
    const authInfo = { userId: authStore.userId, isAdmin: authStore.isAdmin, isTrailcrew: authStore.isTrailcrew }
    spotPanel.loadComments(item.id, authInfo)
    spotPanel.loadPhotoModeration(item.id, authInfo, authService)
    refreshDetails()
  }

  let mounted = false
  onMounted(async () => {
    mounted = true
    // clearNuxtData() is required: refresh() alone is a silent no-op while
    // Nuxt still holds the SSR-time promise for this key.
    clearNuxtData(key)
    await refresh()
    if (spot.value) start(spot.value)
  })

  // Client-side nav to another spot reuses the page instance, and the mount
  // refresh can resolve a spot SSR didn't have — (re)start for the new id.
  watch(() => spot.value?.id, () => {
    if (mounted && spot.value) start(spot.value)
  })

  await asyncData
  // Re-seed: `details` was created before the payload resolved.
  details.value = bakedTrailDetails(trail.value)

  return { trail, spot, details, refreshDetails, removePhoto }
}
