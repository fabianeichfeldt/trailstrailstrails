export const FEATURES = {
  offline_gpx_download: { minLevel: 1, label: 'Offline-Download' },

  // Trail-Zustand: the weather-derived ground verdict, its day strip, the 10-day
  // rain total and the status banner's live rain-rule line. Plus and up — which
  // takes in Pro and the early-adopter Pro grant.
  //
  // Promotion: see SIGNUP_PROMO below. The grant itself is made in SQL by the
  // AFTER INSERT trigger on auth.users (grant_free_access; the live DB differs
  // from migration 20260926180000). The locked teaser (SpotDetailWeatherLocked)
  // advertises it to logged-out visitors only.
  //
  // Enforced server-side by the `trail-condition` edge function in
  // trailradar-backend: it checks the JWT and calls has_min_tier(REQUIRED_LEVEL)
  // as the caller, and it owns Open-Meteo and the model, so this client holds
  // neither. `minLevel` here must equal `REQUIRED_LEVEL` in
  // supabase/functions/trail-condition — one number, two copies; each repo's
  // tests pin it (see features.test.ts). What this entry still does in the
  // browser is UX only: what to render and whether to ask at all.
  trail_condition: { minLevel: 1, label: 'Trail-Zustand' },

  // Boden-Radar: the map layer showing soil state across all spots. Gated
  // server-side by the `soil-map` edge function in trailradar-backend; its
  // REQUIRED_LEVEL must equal this `minLevel` (pinned in features.test.ts).
  soil_radar: { minLevel: 1, label: 'Boden-Radar' },

  // future feature keys go here — one line each
} as const

/**
 * Free Supporter access for new signups: 4 weeks for everyone who signs up by
 * the end of 30.11.2026 (Berlin); existing users' grants end on 30.11. too.
 * Copy only — the grant is made by grant_free_access() in the live DB, which
 * must be changed in step with this.
 */
export const SIGNUP_PROMO = {
  weeks: 4,
  endsAt: new Date('2026-12-01T00:00:00+01:00'),
} as const

export function isSignupPromoActive(now: Date = new Date()): boolean {
  return now < SIGNUP_PROMO.endsAt
}

export type FeatureKey = keyof typeof FEATURES

/**
 * What a page should render for a feature right now. "checking" exists so a
 * user who *does* have access never sees a locked teaser flash up while their
 * entitlement is still loading.
 */
export type FeatureAccess = 'checking' | 'allowed' | 'locked'

// The seeded plans (supabase migration 20260923172739, renamed to "Supporter"
// by 20261002120000). Display only — the levels themselves are what gate
// anything.
const PLAN_NAMES: Record<number, string> = { 1: 'Supporter', 2: 'Pro' }

export function planNameForLevel(level: number): string {
  return PLAN_NAMES[level] ?? `Stufe ${level}`
}

/** The cheapest plan that unlocks a feature — what a locked teaser should point at. */
export function minPlanName(key: FeatureKey): string {
  return planNameForLevel(FEATURES[key].minLevel)
}
