import type { TrailConditionResponse } from '~/types/Weather'
import { fetchTrailCondition } from '~/communication/weather'

export interface ConditionSource {
  spotType: string
  spotId: string
}

/**
 * Loads a spot's Trail-Zustand, client-side only.
 *
 * The `onMounted` guard is the whole point and must not be relaxed into a
 * top-level await or `useAsyncData`: this app ships as SSG, so anything
 * resolved during `nuxt generate` gets frozen into the static HTML. Weather
 * baked at build time would keep showing the build day's conditions until the
 * next deploy — the same failure mode as the prerendered `server/api` routes
 * described in CLAUDE.md, and just as invisible to dev (live Nitro) and to a
 * mocked test suite. SSR renders the skeleton; the real value arrives on the
 * client.
 *
 * `forbidden` is set when the function answers 403 (the browser thought the user
 * was entitled, the server disagrees) so the page can fall back to the teaser.
 */
export function useTrailCondition(source: () => ConditionSource | null) {
  const auth = useAuthStore()
  const condition = ref<TrailConditionResponse | null>(null)
  const loading = ref(true)
  const forbidden = ref(false)

  onMounted(() => {
    watch(
      source,
      async (next) => {
        if (!next) return
        loading.value = true
        forbidden.value = false
        condition.value = await fetchTrailCondition(
          next.spotType,
          next.spotId,
          await auth.getToken(),
          () => { forbidden.value = true },
        )
        loading.value = false
      },
      { immediate: true },
    )
  })

  return { condition, loading, forbidden }
}
