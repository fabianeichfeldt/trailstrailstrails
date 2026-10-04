import { getMyEntitlement, FREE_ENTITLEMENT, type Entitlement } from '~/communication/subscriptions'
import { getMySubscription, getCheckoutEligibility } from '~/communication/billing'
import type { Subscription, CheckoutEligibility } from '~/types/Subscription'
import { FEATURES, type FeatureKey, type FeatureAccess } from '~/entitlements/features'

export const useSubscriptionStore = defineStore('subscription', () => {
  const auth = useAuthStore()
  const entitlement = ref<Entitlement>(FREE_ENTITLEMENT)
  const subscription = ref<Subscription | null>(null)
  const eligibility = ref<CheckoutEligibility | null>(null)
  // True once the entitlement for the current user is known. A logged-out
  // visitor has nothing to wait for, so this starts true for them.
  const loaded = ref(!auth.isLoggedIn)

  async function load() {
    if (!auth.isLoggedIn) {
      entitlement.value = FREE_ENTITLEMENT; subscription.value = null; eligibility.value = null; loaded.value = true
      return
    }
    loaded.value = false
    try {
      const token = await auth.getToken()
      // The billing lookups swallow their own errors, so they can't fail the entitlement.
      const [ent, sub, elig] = await Promise.all([
        getMyEntitlement(token), getMySubscription(token), getCheckoutEligibility(token),
      ])
      entitlement.value = ent
      subscription.value = sub
      eligibility.value = elig
    } catch {
      entitlement.value = FREE_ENTITLEMENT
      subscription.value = null
      eligibility.value = null
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

  // UX only; the billing function re-checks. Native is passed in to keep Capacitor out of the store.
  function canBuy(isNative: boolean): boolean {
    return auth.isLoggedIn && !isNative && eligibility.value?.eligible === true
  }
  const isCancelScheduled = computed(() => subscription.value?.cancelAtPeriodEnd === true)
  const isPastDue = computed(() => subscription.value?.status === 'past_due')

  return { entitlement, subscription, eligibility, canBuy, isCancelScheduled, isPastDue, loaded, hasFeature, accessFor, isEarlyAdopter, load }
})
