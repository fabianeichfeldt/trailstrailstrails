export const FEATURES = {
  offline_gpx_download: { minLevel: 1, label: 'Offline-Download' },

  // Trail-Zustand: the weather-derived ground verdict, its day strip, the 10-day
  // rain total and the status banner's live rain-rule line. Plus and up — which
  // takes in Pro and the early-adopter Pro grant.
  //
  // UI-ONLY GATE, and the entitlement spec calls that a bug: the data comes
  // straight from Open-Meteo in the browser and the model ships in the client
  // bundle, so there is no Postgres resource an RLS policy could protect.
  // Anyone can still call Open-Meteo themselves. Acceptable while every existing
  // user holds a free Pro grant and there is no checkout; NOT acceptable once
  // anyone pays. Before the first payment this needs a server-side check (a
  // Worker like /_embed that verifies the JWT with has_min_tier(1) and calls
  // Open-Meteo with a key) — and Open-Meteo's free tier is non-commercial, so a
  // commercial licence is needed before this is charged for anyway.
  trail_condition: { minLevel: 1, label: 'Trail-Zustand' },

  // future feature keys go here — one line each
} as const

export type FeatureKey = keyof typeof FEATURES

/**
 * What a page should render for a feature right now. "checking" exists so a
 * user who *does* have access never sees a locked teaser flash up while their
 * entitlement is still loading.
 */
export type FeatureAccess = 'checking' | 'allowed' | 'locked'

// The seeded plans (supabase migration 20260923172739). Display only — the
// levels themselves are what gate anything.
const PLAN_NAMES: Record<number, string> = { 1: 'Plus', 2: 'Pro' }

export function planNameForLevel(level: number): string {
  return PLAN_NAMES[level] ?? `Stufe ${level}`
}

/** The cheapest plan that unlocks a feature — what a locked teaser should point at. */
export function minPlanName(key: FeatureKey): string {
  return planNameForLevel(FEATURES[key].minLevel)
}
