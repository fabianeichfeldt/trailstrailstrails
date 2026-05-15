import { trackVisit } from '~/src/communication/visit'

export default defineNuxtPlugin(() => {
  trackVisit(window.location.pathname, document.referrer)

  const router = useRouter()
  router.afterEach((to) => {
    trackVisit(to.path, window.location.href)
  })
})
