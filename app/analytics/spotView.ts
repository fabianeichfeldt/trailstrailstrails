import type { AnalyticsEvent } from './events'

// Counts router.afterEach calls (set by the analytics plugin): the 1st is the page load's own route,
// so a spot view at count <= 1 is a cold open (search, shared link, reload), not in-app navigation.
let routeChanges = 0
export function markRouteChange() { routeChanges++ }
export function isInitialRoute() { return routeChanges <= 1 }

export function spotViewEvent(initialRoute: boolean): AnalyticsEvent {
  return initialRoute ? 'spot_land' : 'spot_open'
}

// A remounted page instance (no route change) must not report the same spot twice.
const claimed = new Set<string>()
export function claimSpotView(spotId: string): boolean {
  const key = `${routeChanges}:${spotId}`
  if (claimed.has(key)) return false
  claimed.add(key)
  return true
}

/** Tests only: module state outlives a single mount. */
export function resetSpotViews() { routeChanges = 0; claimed.clear() }
