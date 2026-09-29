export const FEATURES = {
  offline_gpx_download: { minLevel: 1, label: 'Offline-Download' },
  // future feature keys go here — one line each
} as const

export type FeatureKey = keyof typeof FEATURES
