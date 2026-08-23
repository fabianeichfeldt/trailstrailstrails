// Pure helpers for the SpotManager "Status" section (closed_from / closed_to
// / hint) on spot_gpx_trails — the write side of the trail-status feature
// whose read side is app/types/TrailStatus.ts (deriveTrailStatus).
//
// Extracted (same precedent as app/spot_manager/GpxProcessor.ts) so the
// `datetime-local` <-> ISO 8601 conversions, the "Bis must be after Von"
// validation, and the list-badge label/color lookup can be unit-tested in
// isolation, without mounting the full SpotManagerApp.vue — this is the
// logic app/components/spotmanager/TrailStatusFields.vue and
// SpotManagerApp.vue's openEditTrail()/saveTrailEdit() both call into.
//
// See docs/superpowers/specs/2026-08-02-spotmanager-trail-status-editing-design.md

import { deriveTrailStatus } from '../types/TrailStatus'
import type { TrailStatusInput, TrailStatusState } from '../types/TrailStatus'

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

/** Formats a Date as a `datetime-local` input value (local time, minute precision). */
function formatDatetimeLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** ISO 8601 timestamp (or null/undefined/invalid) -> `datetime-local` input value, or '' when unset. */
export function isoToDatetimeLocal(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return formatDatetimeLocal(d)
}

/** `datetime-local` input value -> ISO 8601 string, or null when empty/invalid. */
export function datetimeLocalToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** Current local datetime, formatted for the "Jetzt" button. */
export function nowAsDatetimeLocal(now: Date = new Date()): string {
  return formatDatetimeLocal(now)
}

/** 23:59 of the next calendar day, formatted for the "Morgen" button. */
export function tomorrowEndOfDayAsDatetimeLocal(now: Date = new Date()): string {
  return formatDatetimeLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59))
}

/**
 * Save-time validation: if Bis (closedTo) is set, it must be strictly after
 * Von (closedFrom). Both args are ISO strings or null, as stored on
 * GpxTrailRow / held by SpotManagerApp's editForm refs. Returns a
 * user-facing German error string, or null when valid.
 */
export function validateClosureWindow(closedFrom: string | null, closedTo: string | null): string | null {
  if (!closedTo) return null
  if (!closedFrom) return null // Bis-without-Von: UI already prevents this by disabling the field
  const from = new Date(closedFrom)
  const to   = new Date(closedTo)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  if (to <= from) return 'Bis muss nach Von liegen.'
  return null
}

export interface TrailBadgeMeta {
  state: TrailStatusState
  label: string
  color: string
}

// Reuses the exact hex values of SpotManagerApp.vue's per-spot STATUS_OPTIONS
// palette (open/limited/closed) — see the design spec's badge color table.
// STATUS_OPTIONS itself isn't exported from that file (it's a local const,
// keyed by the unrelated SpotStatus union), so the values are restated here
// rather than imported.
const BADGE_META: Record<TrailStatusState, { label: string; color: string }> = {
  open:         { label: 'Offen',   color: '#2e7d32' },
  closing_soon: { label: 'Hinweis', color: '#e65100' },
  closed:       { label: 'Gesperrt', color: '#c62828' },
}

/** Trail-list badge label/color for a spot_gpx_trails row, derived via the shared deriveTrailStatus(). */
export function trailBadgeMeta(input: TrailStatusInput, now: Date = new Date()): TrailBadgeMeta {
  const { state } = deriveTrailStatus(input, now)
  return { state, ...BADGE_META[state] }
}
