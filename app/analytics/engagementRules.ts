import type { AnalyticsEvent } from './events'

// Mirrors the report's "engaged" rule (v2). Not counted: spot_land, active, engaged.
export const COUNTED_ACTIONS: ReadonlySet<AnalyticsEvent> = new Set<AnalyticsEvent>([
  'map_pin_open', 'search', 'filter_toggle', 'locate_me', 'item_select',
  'photo_open', 'share', 'parking_select', 'like', 'spot_open',
])

/** A spot_open this soon after a pin tap / search pick is the same user action. */
export const SAME_ACTION_WINDOW_MS = 5000
export const SAME_ACTION_LEADS: ReadonlySet<AnalyticsEvent> = new Set<AnalyticsEvent>(['map_pin_open', 'search'])
export const ENGAGED_AFTER = 2
