import { getMyEntitlement, FREE_ENTITLEMENT, type Entitlement } from '~/communication/subscriptions'
import { FEATURES, type FeatureKey, type FeatureAccess } from '~/entitlements/features'

export const useSubscriptionStore = defineStore('subscription', () => {
  const auth = useAuthStore()
  const entitlement = ref<Entitlement>(FREE_ENTITLEMENT)
  // True once the entitlement for the current user is known. A logged-out
  // visitor has nothing to wait for, so this starts true for them.
  const loaded = ref(!auth.isLoggedIn)

  async function load() {
    if (!auth.isLoggedIn) { entitlement.value = FREE_ENTITLEMENT; loaded.value = true; return }
    loaded.value = false
    try {
      entitlement.value = await getMyEntitlement(await auth.getToken())
    } catch {
      entitlement.value = FREE_ENTITLEMENT
    } finally {
      // Always, so a page waiting on this is never stuck on a skeleton.
      loaded.value = true
    }
  }
  watch(() => auth.user, load, { immediate: true })

  function hasFeature(key: FeatureKey): boolean {
    return entitlement.value.level >= FEATURES[key].minLevel
  }

  /**
   * What to render for a feature: "checking" while a logged-in user's entitlement
   * is still on its way (so a paying user never sees a locked teaser flash up),
   * otherwise "allowed" or "locked". UI only — see FEATURES for what that means.
   */
  function accessFor(key: FeatureKey): FeatureAccess {
    if (!auth.isLoggedIn) return 'locked'
    if (!loaded.value) return 'checking'
    return hasFeature(key) ? 'allowed' : 'locked'
  }

  const isEarlyAdopter = computed(() => entitlement.value.earlyAdopterFreeUntil !== null)

  return { entitlement, loaded, hasFeature, accessFor, isEarlyAdopter, load }
})
