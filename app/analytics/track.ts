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

const recordEngagement = createEngagement(() => send('engaged'))

/** Silent no-op when Umami is absent (dev, tests, blocked, SSR). */
export function track(event: AnalyticsEvent, data?: AnalyticsData) {
  send(event, data)
  recordEngagement(event)
}
