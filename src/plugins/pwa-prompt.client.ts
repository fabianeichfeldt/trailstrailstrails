import { setDeferredInstallPrompt, type BeforeInstallPromptEvent } from '~/composables/pwaInstallPrompt'

declare global {
  interface Window { __pwaPrompt?: BeforeInstallPromptEvent }
}

export default defineNuxtPlugin(() => {
  // Pick up the event if the inline <head> script already caught it
  // (fires before framework JS on slow Android devices).
  if (window.__pwaPrompt) {
    setDeferredInstallPrompt(window.__pwaPrompt)
    return
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    setDeferredInstallPrompt(e as BeforeInstallPromptEvent)
  })
})
