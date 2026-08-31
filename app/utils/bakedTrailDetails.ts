import { TrailDetails } from '~/types/TrailDetails'

/**
 * Builds a TrailDetails-shaped object from the SSG-baked trail JSON
 * (server/api/trail/[id].get.ts's `{ ...base, ...trail_details_row, type,
 * photos }` merge, prerendered into static output by the nitro crawler —
 * see CLAUDE.md's "No live Nitro server in production").
 *
 * Used to seed app/components/trail_detail/SpotDetailInfo.vue so the
 * description/rules/opening-hours/photos content renders immediately from
 * the prerendered payload (SEO-safe, no loading flash) before the client
 * kicks off a live getTrailDetails() refresh for the genuinely dynamic
 * bits (status hint, likes) that aren't in the static payload at all.
 *
 * `likes`/`videos` are never part of the baked payload (the crawler-fetched
 * /api/trail/[id] route doesn't join either table) — they default empty
 * until the live refresh resolves, same as before this rework.
 */
export function bakedTrailDetails(raw: Record<string, any> | null | undefined): TrailDetails {
  const d = new TrailDetails(raw?.id ?? '')
  if (!raw) return d
  d.rules = raw.rules ?? []
  d.description = raw.description ?? ''
  d.last_update = raw.last_update ?? d.last_update
  d.opening_hours = raw.opening_hours ?? ''
  d.trail_description = raw.trail_description ?? ''
  d.photos = raw.photos ?? []
  d.status = raw.status
  d.status_until = raw.status_until
  d.status_hint = raw.status_hint
  d.access_type = raw.access_type
  d.donation_url = raw.donation_url
  d.seasonal_from = raw.seasonal_from
  d.seasonal_to = raw.seasonal_to
  d.rain_policy = raw.rain_policy
  d.rain_closed_hours = raw.rain_closed_hours
  return d
}
