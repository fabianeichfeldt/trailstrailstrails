// Trail status visualization — pure derivation logic.
//
// Placement: this is a bottom-of-graph pure module (no imports at all),
// alongside src/types/Trail.ts. It must be importable from both
// src/communication/ (data layer, forbidden from importing stores/,
// composables/, or src/map/ — see .dependency-cruiser.cjs) and from
// src/composables/useTrailMap.ts (the only place Leaflet exists). src/types/
// is the one layer both of those are already allowed to depend on, so a new
// file here — rather than src/communication/ or src/map/ — keeps the module
// usable from either side without adding a new edge to the dependency graph.
//
// See docs/superpowers/specs/2026-07-31-trail-status-visualization-design.md
// for the full "Status derivation" table this implements.

export type TrailStatusState = 'open' | 'closing_soon' | 'closed'

export interface TrailStatusInput {
  closed_from?: string | null
  closed_to?: string | null
  hint?: string | null
}

export interface TrailStatusResult {
  state: TrailStatusState
  /** Short headline for the popup/sheet, e.g. "Aktuell gesperrt". Null when state is 'open'. */
  title: string | null
  /** "seit DD.MM.YYYY [bis DD.MM.YYYY]" / "ab DD.MM.YYYY [bis DD.MM.YYYY]" — null when there's no schedule (hint-only, or open). */
  dateLine: string | null
  /** Trimmed free-text hint, or null when none was set. Rendered as its own line by the caller — never pre-joined into a single string, so the UI can style title/date/hint/attribution independently. */
  hint: string | null
}

function isNonEmpty(s?: string | null): s is string {
  return typeof s === 'string' && s.trim().length > 0
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** DD.MM.YYYY — deliberately not Intl/locale-based, so it's stable across test/CI environments. */
function formatDate(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** "seit DD.MM.YYYY[ bis DD.MM.YYYY]" or "ab DD.MM.YYYY[ bis DD.MM.YYYY]". */
function dateLine(preposition: string, from: Date, to: Date | null): string {
  return to
    ? `${preposition} ${formatDate(from)} bis ${formatDate(to)}`
    : `${preposition} ${formatDate(from)}`
}

const OPEN: TrailStatusResult = { state: 'open', title: null, dateLine: null, hint: null }

/**
 * Derives the live trail-closure status of a spot_gpx_trails row. Always
 * surfaces since-when (and until-when, if known) a closure applies — the
 * date line is never dropped just because a hint was also set. The caller
 * (see src/map/trailStatusSheet.ts) is responsible for also attributing the
 * information to the spot's trailcrew when rendering.
 *
 * `now` is injected (never read from Date.now() internally) so this stays a
 * pure, deterministically-testable function. See the design spec's
 * "Status derivation" table:
 *
 *   closed_from set AND now >= closed_from AND (closed_to IS NULL OR now <= closed_to)  → closed
 *   closed_from set AND now < closed_from                                              → closing soon
 *   closed_from IS NULL AND hint set (non-empty)                                       → hint (same badge as closing soon)
 *   otherwise (including an expired schedule)                                          → open
 */
export function deriveTrailStatus(input: TrailStatusInput, now: Date): TrailStatusResult {
  const hasHint = isNonEmpty(input.hint)
  const hint    = hasHint ? input.hint!.trim() : null

  if (input.closed_from) {
    const from = new Date(input.closed_from)
    const to   = input.closed_to ? new Date(input.closed_to) : null

    if (now >= from && (!to || now <= to)) {
      return { state: 'closed', title: 'Aktuell gesperrt', dateLine: dateLine('seit', from, to), hint }
    }
    if (now < from) {
      return { state: 'closing_soon', title: 'Bald gesperrt', dateLine: dateLine('ab', from, to), hint }
    }
    // Schedule has fully expired (now > closed_to) — back to open, regardless of hint.
    return OPEN
  }

  if (hasHint) {
    return { state: 'closing_soon', title: 'Hinweis', dateLine: null, hint }
  }

  return OPEN
}
