import { Capacitor } from '@capacitor/core'

/**
 * Whether we run inside the Capacitor native shell — false on the server and
 * until mount, so the prerendered HTML is identical for everyone (as useFeatureAccess).
 */
export function useIsNativeApp() {
  const isNative = ref(false)
  onMounted(() => {
    isNative.value = Capacitor.isNativePlatform()
  })
  return isNative
}
