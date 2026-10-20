import { trailConditionAdapter, type ConditionSource } from '~/communication/weather'
import { createGatedFetch } from '~/entitlements/gatedFetch'

export type { ConditionSource }

/**
 * Loads a spot's Trail-Zustand through the paid-feature gate, client-side only.
 *
 * The `onMounted` guard is the whole point and must not be relaxed into a
 * top-level await or `useAsyncData`: this app ships as SSG, so anything
 * resolved during `nuxt generate` gets frozen into the static HTML. Weather
 * baked at build time would keep showing the build day's conditions until the
 * next deploy — the same failure mode as the prerendered `server/api` routes
 * described in CLAUDE.md, and just as invisible to dev (live Nitro) and to a
 * mocked test suite. SSR renders `state` 'checking' (the skeleton); the real
 * value arrives on the client.
 *
 * `state` is 'locked' for a visitor without access and after a 403 (the browser
 * thought the user was entitled, the server disagrees) — the page shows the teaser.
 */
export function useTrailCondition(source: () => ConditionSource | null) {
  const auth = useAuthStore()
  const subscription = useSubscriptionStore()
  const gate = createGatedFetch(trailConditionAdapter, {
    access: () => subscription.accessFor('trail_condition'),
    userId: () => auth.userId,
    getUserId: () => auth.getUserId(),
    getToken: () => auth.getToken(),
  })

  // Who asks for which spot; any change means a new request (or none while not allowed).
  const request = computed(() => {
    const s = source()
    const st = gate.state.value
    if (!s || st === 'checking' || st === 'locked') return null
    return { key: `${auth.userId}|${s.spotType}|${s.spotId}`, source: s }
  })

  onMounted(() => {
    gate.markMounted()
    watch(() => request.value?.key, () => {
      if (request.value) void gate.load(request.value.source)
    }, { immediate: true })
  })

  const loading = computed(() => gate.state.value === 'checking' || gate.state.value === 'loading')
  return { condition: gate.data, loading, state: gate.state }
}
