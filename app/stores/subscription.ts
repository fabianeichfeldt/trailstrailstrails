import { getMyEntitlement, FREE_ENTITLEMENT, type Entitlement } from '~/communication/subscriptions'
import { FEATURES, type FeatureKey } from '~/entitlements/features'

export const useSubscriptionStore = defineStore('subscription', () => {
  const auth = useAuthStore()
  const entitlement = ref<Entitlement>(FREE_ENTITLEMENT)

  async function load() {
    if (!auth.isLoggedIn) { entitlement.value = FREE_ENTITLEMENT; return }
    entitlement.value = await getMyEntitlement(await auth.getToken())
  }
  watch(() => auth.user, load, { immediate: true })

  function hasFeature(key: FeatureKey): boolean {
    return entitlement.value.level >= FEATURES[key].minLevel
  }

  const isEarlyAdopter = computed(() => entitlement.value.earlyAdopterFreeUntil !== null)

  return { entitlement, hasFeature, isEarlyAdopter, load }
})
