import type { FeatureKey, FeatureAccess } from '~/entitlements/features'

/**
 * Whether the current visitor may use a feature — "checking", "allowed" or
 * "locked" — safe to use on a prerendered page.
 *
 * This app ships as SSG, so whatever a page renders on the server is frozen into
 * the static HTML for every visitor. Access depends on who is looking, so it can
 * never be decided there: on the server (and until the component has mounted)
 * this always says "checking", and the real answer only exists in the browser.
 * Without that, an entitled user's page would hydrate against HTML that was
 * prerendered as locked.
 */
export function useFeatureAccess(key: FeatureKey) {
  const subscription = useSubscriptionStore()
  const mounted = ref(false)
  onMounted(() => {
    mounted.value = true
  })
  return computed<FeatureAccess>(() => (mounted.value ? subscription.accessFor(key) : 'checking'))
}
