import type { AnalyticsData, AnalyticsEvent } from './events'
import { createEngagement } from './engagement'

declare global {
  interface Window {
    umami?: { track: (event: string, data?: AnalyticsData) => void }
  }
}

function send(event: AnalyticsEvent, data?: AnalyticsData) {
  if (typeof window === 'undefined') return
  window.umami?.track(event, data)
}

const engagedListeners = new Set<() => void>()
let engaged = false

const recordEngagement = createEngagement(() => {
  engaged = true
  send('engaged')
  engagedListeners.forEach(fn => fn())
})

/** True once this page load's visit fired `engaged`. */
export function hasEngaged(): boolean {
  return engaged
}

/** Calls `fn` when `engaged` fires; returns the unsubscribe. */
export function onEngaged(fn: () => void): () => void {
  engagedListeners.add(fn)
  return () => { engagedListeners.delete(fn) }
}

/** Silent no-op when Umami is absent (dev, tests, blocked, SSR). */
export function track(event: AnalyticsEvent, data?: AnalyticsData) {
  send(event, data)
  recordEngagement(event)
}
