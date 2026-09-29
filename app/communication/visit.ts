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

// Debounced to collapse chained router transitions (navigateToSpot's
// replace+push, legacy id->slug redirects) into one call.
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
