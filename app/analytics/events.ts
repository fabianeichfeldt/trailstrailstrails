// Closed list: every Umami custom event the app may send. `engaged` is derived; `active` is the heartbeat; `spot_land` is a spot page as first route of the page load.
export const ANALYTICS_EVENTS = [
  'spot_open', 'item_select', 'search', 'filter_toggle', 'locate_me',
  'photo_open', 'share', 'parking_select', 'map_pin_open', 'like', 'spot_land', 'active', 'engaged',
] as const

export type AnalyticsEvent = typeof ANALYTICS_EVENTS[number]
export type AnalyticsData = Record<string, string | number | boolean>
