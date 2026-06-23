import { setDeferredInstallPrompt, type BeforeInstallPromptEvent } from '~/composables/pwaInstallPrompt'

// Captures beforeinstallprompt at plugin init time — well before any
// ClientOnly component mounts — so the event is never missed.
export default defineNuxtPlugin(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    setDeferredInstallPrompt(e as BeforeInstallPromptEvent)
  })
})
