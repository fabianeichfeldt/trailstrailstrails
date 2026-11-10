import type { AnalyticsEvent } from './events'
import { COUNTED_ACTIONS, ENGAGED_AFTER, SAME_ACTION_LEADS, SAME_ACTION_WINDOW_MS } from './engagementRules'

export { ENGAGED_AFTER }

/** In-memory per page load (no storage, consent-free): fires `engaged` once after the 2nd counted action. */
export function createEngagement(onEngaged: () => void, threshold = ENGAGED_AFTER, now: () => number = Date.now) {
  let count = 0
  let fired = false
  let leadAt = -Infinity
  return function record(event: AnalyticsEvent) {
    if (fired || !COUNTED_ACTIONS.has(event)) return
    const t = now()
    if (event === 'spot_open' && t - leadAt <= SAME_ACTION_WINDOW_MS) return
    if (SAME_ACTION_LEADS.has(event)) leadAt = t
    if (++count >= threshold) {
      fired = true
      onEngaged()
    }
  }
}
