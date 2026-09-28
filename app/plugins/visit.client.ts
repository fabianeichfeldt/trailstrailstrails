import { createVisitTracker } from '~/communication/visit'

export default defineNuxtPlugin(() => {
  const scheduleVisit = createVisitTracker()

  scheduleVisit(window.location.pathname, document.referrer)

  const router = useRouter()
  router.afterEach((to) => {
    scheduleVisit(to.path, window.location.href)
  })
})
