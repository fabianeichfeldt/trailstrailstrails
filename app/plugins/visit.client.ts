import { createVisitTracker } from '~/communication/visit'

export default defineNuxtPlugin(() => {
  // Debounced tracker — see createVisitTracker for why: without it, a single
  // "open this spot" click can log 2-4 add-visit rows (router.replace +
  // router.push + legacy id->slug redirect all fire their own afterEach).
  const scheduleVisit = createVisitTracker()

  scheduleVisit(window.location.pathname, document.referrer)

  const router = useRouter()
  router.afterEach((to) => {
    scheduleVisit(to.path, window.location.href)
  })
})
