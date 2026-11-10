import type { AnalyticsEvent } from './events'

export const ENGAGED_AFTER = 2

/** In-memory per page load (no storage, consent-free): fires `engaged` once after the 2nd meaningful event. */
export function createEngagement(onEngaged: () => void, threshold = ENGAGED_AFTER) {
  let count = 0
  let fired = false
  return function record(event: AnalyticsEvent) {
    if (event === 'engaged' || fired) return
    if (++count >= threshold) {
      fired = true
      onEngaged()
    }
  }
}
