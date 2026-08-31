// A "back" control that has to work where there is no browser chrome and no
// hardware back button: the installed PWA (standalone display-mode) and the
// Capacitor native shell on iOS. Any full-page route (trails/[slug], the
// region pages, …) MUST ship its own way back or the user gets stranded.
// See CLAUDE.md "No browser chrome outside a normal tab".
//
// router.back() when there is in-app history (returns to the map with its
// pan/zoom/panel state, or to whatever page linked here); a hard navigate to
// the fallback when the page was opened cold from a shared link / search
// result / home-screen icon / push and there is nothing to go back to.
export function useBackNavigation() {
  const router = useRouter()

  function goBack(fallback = '/map') {
    if (typeof window !== 'undefined' && window.history.state?.back) {
      router.back()
    } else {
      navigateTo(fallback)
    }
  }

  return { goBack }
}
