import { ref, onUnmounted } from 'vue'
import { deferredInstallPrompt } from './pwaInstallPrompt'

export function usePwaInstall() {
  const show = ref(false)
  const isIos = ref(false)

  // 1. Already running as installed PWA — bail out
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return { show, isIos, install, dismiss }
  }

  // 2. Dismissed recently (within 14 days) — bail out
  const dismissedAt = localStorage.getItem('pwa-dismiss')
  if (dismissedAt) {
    const elapsed = Date.now() - Number(dismissedAt)
    if (elapsed < 14 * 24 * 60 * 60 * 1000) {
      return { show, isIos, install, dismiss }
    }
  }

  // 3. iOS detection
  isIos.value = /iphone|ipad|ipod/i.test(navigator.userAgent)

  // 4. Dwell timer — show banner after 8 seconds
  const timerId = setTimeout(() => { show.value = true }, 8000)
  onUnmounted(() => clearTimeout(timerId))

  // 5. install() — triggers the native prompt captured by the plugin at app start
  async function install() {
    const prompt = deferredInstallPrompt
    if (!prompt) return
    await prompt.prompt()
    await prompt.userChoice
    dismiss()
  }

  // 6. dismiss() — hide and persist for 14 days
  function dismiss() {
    show.value = false
    localStorage.setItem('pwa-dismiss', String(Date.now()))
  }

  return { show, isIos, install, dismiss }
}
