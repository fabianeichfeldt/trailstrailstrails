import { FUNCTIONS, anonHeaders } from './http'

function isPwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function trackVisit(path: string, referrer: string): void {
  fetch(`${FUNCTIONS}/add-visit`, {
    method: 'POST',
    headers: {
      ...anonHeaders(),
      referrer,
      path,
      pwa: String(isPwa()),
    },
  }).catch(() => {})
}

// Several flows chain more than one router transition for a single click —
// e.g. useTrailMap.ts's navigateToSpot() does router.replace('/map?trail=id')
// then router.push('/trails/slug'), and the legacy id->slug redirect in
// trails/[slug].vue adds a third hop for old links. Each hop fires its own
// router.afterEach, so tracking every one logs 2-4 "visits" for what the
// user experiences as a single page view. Debouncing collapses a burst of
// same-tick-ish hops into a single call for the final, settled path — real
// distinct page views (landing -> trail1 -> trail2) are always spaced far
// beyond this window and still get tracked individually.
const VISIT_DEBOUNCE_MS = 500

export function createVisitTracker(send: (path: string, referrer: string) => void = trackVisit) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let referrer = ''

  return function scheduleVisit(path: string, currentReferrer: string): void {
    if (timer === null) referrer = currentReferrer
    else clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      send(path, referrer)
    }, VISIT_DEBOUNCE_MS)
  }
}
