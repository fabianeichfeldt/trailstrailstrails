import { ref, onUnmounted } from 'vue'
import { bottomBannerActive } from './bottomBannerSlot'

const DISMISS_KEY   = 'android-beta-hint-dismiss'
const SIGNED_UP_KEY = 'android-beta-signed-up'
const DISMISS_WINDOW_MS = 3 * 24 * 60 * 60 * 1000
const DWELL_MS = 10_000

export function useAndroidBetaHint() {
  const show = ref(false)

  // 1. Not an Android device — this hint is irrelevant
  if (!/android/i.test(navigator.userAgent)) {
    return { show, dismiss }
  }

  // 2. Already signed up for the beta — never nag again
  if (localStorage.getItem(SIGNED_UP_KEY)) {
    return { show, dismiss }
  }

  // 3. Dismissed recently (within 3 days) — bail  #out
  const dismissedAt = localStorage.getItem(DISMISS_KEY)
  if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_WINDOW_MS) {
    return { show, dismiss }
  }

  // 4. Dwell timer — show after 10s, but only if the bottom-sheet slot is
  // free (e.g. the PWA install banner isn't currently occupying it).
  const timerId = setTimeout(() => {
    if (bottomBannerActive.value) return
    show.value = true
    bottomBannerActive.value = true
  }, DWELL_MS)
  onUnmounted(() => clearTimeout(timerId))

  function dismiss() {
    show.value = false
    bottomBannerActive.value = false
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }

  return { show, dismiss }
}
