import type { SpotWeather } from '~/types/Weather'
import { fetchSpotWeather } from '~/communication/weather'

export interface SpotCoords {
  lat: number
  lon: number
}

/**
 * Loads a spot's weather, client-side only.
 *
 * The `onMounted` guard is the whole point and must not be relaxed into a
 * top-level await or `useAsyncData`: this app ships as SSG, so anything
 * resolved during `nuxt generate` gets frozen into the static HTML. Weather
 * baked at build time would keep showing the build day's conditions until the
 * next deploy — the same failure mode as the prerendered `server/api` routes
 * described in CLAUDE.md, and just as invisible to dev (live Nitro) and to a
 * mocked test suite. SSR renders the skeleton; the real value arrives on the
 * client.
 */
export function useSpotWeather(coords: () => SpotCoords | null) {
  const weather = ref<SpotWeather | null>(null)
  const loading = ref(true)

  onMounted(() => {
    watch(
      coords,
      async (next) => {
        if (!next) return
        loading.value = true
        weather.value = await fetchSpotWeather(next.lat, next.lon)
        loading.value = false
      },
      { immediate: true },
    )
  })

  return { weather, loading }
}
