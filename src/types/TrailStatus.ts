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
  /** Explanation text to show in the popup/sheet. Null when state is 'open' (no badge rendered). */
  explanation: string | null
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

function autoClosingSoonMessage(from: Date, to: Date | null): string {
  return to
    ? `Geplante Sperrung ab ${formatDate(from)} bis ${formatDate(to)}.`
    : `Geplante Sperrung ab ${formatDate(from)}.`
}

const GENERIC_CLOSED_MESSAGE = 'Dieser Trail ist derzeit gesperrt.'

/**
 * Derives the live trail-closure status of a spot_gpx_trails row.
 *
 * `now` is injected (never read from Date.now() internally) so this stays a
 * pure, deterministically-testable function. See the design spec's
 * "Status derivation" table:
 *
 *   closed_from set AND now >= closed_from AND (closed_to IS NULL OR now <= closed_to)  → closed
 *   closed_from set AND now < closed_from                                              → closing soon
 *   closed_from IS NULL AND hint set (non-empty)                                       → hint (same badge as closing soon)
 *   otherwise (including an expired schedule)                                          → open
 *
 * `hint`, when set, is always used verbatim as the explanation in any
 * non-open state — it wins over the auto-generated date message.
 */
export function deriveTrailStatus(input: TrailStatusInput, now: Date): TrailStatusResult {
  const hasHint = isNonEmpty(input.hint)

  if (input.closed_from) {
    const from = new Date(input.closed_from)
    const to   = input.closed_to ? new Date(input.closed_to) : null

    if (now >= from && (!to || now <= to)) {
      return { state: 'closed', explanation: hasHint ? input.hint!.trim() : GENERIC_CLOSED_MESSAGE }
    }
    if (now < from) {
      return { state: 'closing_soon', explanation: hasHint ? input.hint!.trim() : autoClosingSoonMessage(from, to) }
    }
    // Schedule has fully expired (now > closed_to) — back to open, regardless of hint.
    return { state: 'open', explanation: null }
  }

  if (hasHint) {
    return { state: 'closing_soon', explanation: input.hint!.trim() }
  }

  return { state: 'open', explanation: null }
}
