import { describe, it, expect } from 'vitest'
import {
  isoToDatetimeLocal,
  datetimeLocalToIso,
  nowAsDatetimeLocal,
  tomorrowEndOfDayAsDatetimeLocal,
  validateClosureWindow,
  trailBadgeMeta,
} from './trailStatusForm'

describe('isoToDatetimeLocal', () => {
  it('returns "" for null/undefined/empty', () => {
    expect(isoToDatetimeLocal(null)).toBe('')
    expect(isoToDatetimeLocal(undefined)).toBe('')
    expect(isoToDatetimeLocal('')).toBe('')
  })

  it('returns "" for an invalid timestamp', () => {
    expect(isoToDatetimeLocal('not-a-date')).toBe('')
  })

  it('round-trips through datetimeLocalToIso', () => {
    const local = '2026-08-15T14:30'
    const iso = datetimeLocalToIso(local)!
    expect(isoToDatetimeLocal(iso)).toBe(local)
  })
})

describe('datetimeLocalToIso', () => {
  it('returns null for an empty string', () => {
    expect(datetimeLocalToIso('')).toBeNull()
  })

  it('converts a datetime-local value to a valid ISO string', () => {
    const iso = datetimeLocalToIso('2026-08-15T14:30')
    expect(iso).not.toBeNull()
    expect(new Date(iso!).toISOString()).toBe(iso)
  })
})

describe('nowAsDatetimeLocal ("Jetzt" button)', () => {
  it('formats the injected now as a datetime-local string', () => {
    const now = new Date(2026, 7, 2, 9, 5) // 2026-08-02 09:05 local
    expect(nowAsDatetimeLocal(now)).toBe('2026-08-02T09:05')
  })
})

describe('tomorrowEndOfDayAsDatetimeLocal ("Morgen" button)', () => {
  it('formats 23:59 of the next calendar day', () => {
    const now = new Date(2026, 7, 2, 9, 5)
    expect(tomorrowEndOfDayAsDatetimeLocal(now)).toBe('2026-08-03T23:59')
  })

  it('rolls over a month/year boundary', () => {
    const now = new Date(2026, 11, 31, 23, 0) // 2026-12-31 23:00
    expect(tomorrowEndOfDayAsDatetimeLocal(now)).toBe('2027-01-01T23:59')
  })
})

// ── saveTrailEdit() payload construction ────────────────────────────────────
// SpotManagerApp.vue's saveTrailEdit() sends editFormClosedFrom/editFormClosedTo
// (already-converted ISO strings, held by refs the parent owns) plus
// editFormHint straight through to upsertTrail() as closed_from/closed_to/hint.
// validateClosureWindow() is the gate it calls first. These cases mirror the
// design spec's save-path test list.
describe('validateClosureWindow (saveTrailEdit save-gate)', () => {
  it('no-closure case: both null -> valid, payload would be {closed_from: null, closed_to: null}', () => {
    expect(validateClosureWindow(null, null)).toBeNull()
  })

  it('Von-only case: closed_to null -> valid regardless of closed_from', () => {
    expect(validateClosureWindow('2026-08-02T09:00:00.000Z', null)).toBeNull()
  })

  it('Von+Bis case: closed_to strictly after closed_from -> valid', () => {
    expect(validateClosureWindow('2026-08-02T09:00:00.000Z', '2026-08-03T09:00:00.000Z')).toBeNull()
  })

  it('hint-only case: hint is independent of the closure window, not checked here', () => {
    // hint has no bearing on this validator at all — no closed_from/closed_to set.
    expect(validateClosureWindow(null, null)).toBeNull()
  })

  it('Bis-before-Von (and Bis-equal-Von) -> validation error', () => {
    expect(validateClosureWindow('2026-08-03T09:00:00.000Z', '2026-08-02T09:00:00.000Z'))
      .toBe('Bis muss nach Von liegen.')
    expect(validateClosureWindow('2026-08-02T09:00:00.000Z', '2026-08-02T09:00:00.000Z'))
      .toBe('Bis muss nach Von liegen.')
  })

  it('Bis set without Von -> no error (UI already prevents this by disabling the field)', () => {
    expect(validateClosureWindow(null, '2026-08-03T09:00:00.000Z')).toBeNull()
  })
})

// ── Trail list badge ─────────────────────────────────────────────────────────
describe('trailBadgeMeta (SpotManager trail-list badge)', () => {
  const now = new Date('2026-08-02T12:00:00.000Z')

  it('open: no closure, no hint', () => {
    expect(trailBadgeMeta({}, now)).toEqual({ state: 'open', label: 'Offen', color: '#2e7d32' })
  })

  it('closing_soon: hint-only', () => {
    expect(trailBadgeMeta({ hint: 'Nach Regen rutschig' }, now))
      .toEqual({ state: 'closing_soon', label: 'Hinweis', color: '#e65100' })
  })

  it('closing_soon: scheduled future closure', () => {
    expect(trailBadgeMeta({ closed_from: '2026-08-10T00:00:00.000Z' }, now))
      .toEqual({ state: 'closing_soon', label: 'Hinweis', color: '#e65100' })
  })

  it('closed: currently within the closure window', () => {
    expect(trailBadgeMeta({ closed_from: '2026-08-01T00:00:00.000Z' }, now))
      .toEqual({ state: 'closed', label: 'Gesperrt', color: '#c62828' })
  })

  it('open: closure window has fully expired', () => {
    expect(trailBadgeMeta({ closed_from: '2026-07-01T00:00:00.000Z', closed_to: '2026-07-15T00:00:00.000Z' }, now))
      .toEqual({ state: 'open', label: 'Offen', color: '#2e7d32' })
  })
})
