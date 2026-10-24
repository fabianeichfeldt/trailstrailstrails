import { soilMapAdapter } from '~/communication/soilMap'
import { trailConditionAdapter } from '~/communication/weather'
import { sweepCaches } from '~/entitlements/gatedFetch'

// Every paid feature's adapter: a new one goes here too (architecture.test.ts checks).
const PAID_CACHE_PREFIXES = [trailConditionAdapter, soilMapAdapter].map(a => a.cachePrefix)

// Paid data must not outlive a sign-out on a shared browser — from any page, another tab or token expiry,
// whether or not a gate is alive. '' → user is just auth resolving on page load.
export default defineNuxtPlugin(() => {
  const auth = useAuthStore()
  watch(() => auth.userId, (now, before) => {
    if (before && now !== before) sweepCaches(PAID_CACHE_PREFIXES)
  }, { flush: 'sync' })
})
