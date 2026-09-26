export const FEATURES = {
  offline_gpx_download: { minLevel: 1, label: 'Offline-Download' },

  // Trail-Zustand: the weather-derived ground verdict, its day strip, the 10-day
  // rain total and the status banner's live rain-rule line. Plus and up — which
  // takes in Pro and the early-adopter Pro grant.
  //
  // Promotion: every signup gets a free 6-month grant (rolling per user, not a
  // fixed end date; discount 0) via an AFTER INSERT trigger on auth.users, plus
  // a one-time backfill — see supabase/migrations/20260926180000_grant_free_plus_on_signup.sql.
  // The plan is chosen in SQL: lowest active level >= 1. The locked teaser
  // (SpotDetailWeatherLocked) advertises this to logged-out visitors only.
  //
  // Enforced server-side by the `trail-condition` edge function in
  // trailradar-backend: it checks the JWT and calls has_min_tier(REQUIRED_LEVEL)
  // as the caller, and it owns Open-Meteo and the model, so this client holds
  // neither. `minLevel` here must equal `REQUIRED_LEVEL` in
  // supabase/functions/trail-condition — one number, two copies; each repo's
  // tests pin it (see features.test.ts). What this entry still does in the
  // browser is UX only: what to render and whether to ask at all.
  //
  // Remaining caveat before the first payment: Open-Meteo's free tier is
  // non-commercial, so a commercial licence is needed (the function reads the key
  // from its OPEN_METEO_API_KEY secret — a secret change, not a code change).
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
