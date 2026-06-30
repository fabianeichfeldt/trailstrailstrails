import { trackVisit } from '~/communication/visit'

export default defineNuxtPlugin(() => {
  trackVisit(window.location.pathname, document.referrer)

  const router = useRouter()
  let initialNavigationDone = false
  router.afterEach((to) => {
    if (!initialNavigationDone) {
      initialNavigationDone = true
      return
    }
    trackVisit(to.path, window.location.href)
  })
})
