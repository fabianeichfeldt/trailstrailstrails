import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Browser } from '@capacitor/browser'
import { App } from '@capacitor/app'
import { runBackHandlers } from '~/utils/nativeBack'
import { showToast } from '~/utils/toast'

// App UI is dark-themed throughout, so a single global light-content
// (white icon) status bar matches every screen — see the mobile-topbar
// fix in map.vue, which was switched from white to dark for the same reason.
export default defineNuxtPlugin({
  enforce: 'post',
  setup() {
    if (!Capacitor.isNativePlatform()) return

    // Icon color only — overlaysWebView/setBackgroundColor are no-ops on
    // Android 15+ (enforced edge-to-edge, see MainActivity.java, which pads
    // the WebView with real WindowInsets instead of relying on this plugin).
    StatusBar.setStyle({ style: Style.Dark })

    // Any link leaving the app's own origin (Instagram, PayPal, donation
    // URLs, the spot-panel's raw-HTML popup links, …) opens in the system
    // browser instead of navigating the app's own WebView — matches what
    // a native app is expected to do, and avoids trapping the user with no
    // way back short of the back button. Same-origin links (incl. privacy/
    // terms, which use target="_blank") are left alone to navigate in-app.
    document.addEventListener('click', (event) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return

      let url: URL
      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }

      if (url.origin === window.location.origin) return
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return

      event.preventDefault()
      Browser.open({ url: url.href })
    }, { capture: true })

    // Registered once, for the app's lifetime, so it handles back on every
    // screen — including the root page, which mounts no page-scoped handler
    // at all. Page-scoped dismissal (spot panel, status sheet, add-mode on
    // /map) runs first via runBackHandlers(); this is only the fallback.
    let lastExitPressAt = 0
    App.addListener('backButton', ({ canGoBack }) => {
      if (runBackHandlers()) return
      if (canGoBack) { window.history.back(); return }
      // Nothing left to close and nowhere left to go back to — require a
      // second press within 2s rather than exiting on a single accidental tap.
      if (Date.now() - lastExitPressAt < 2000) {
        App.exitApp()
      } else {
        lastExitPressAt = Date.now()
        showToast('Nochmal drücken zum Beenden')
      }
    })
  },
})
