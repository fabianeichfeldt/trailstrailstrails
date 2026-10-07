import { describe, it, expect } from 'vitest'
import { nextRunAfter, SOIL_RUN_HOURS } from './soilSchedule'

const iso = (d: Date) => d.toISOString()

describe('nextRunAfter', () => {
  it('runs at 06/09/12/15/18 Berlin', () => {
    expect(SOIL_RUN_HOURS).toEqual([6, 9, 12, 15, 18])
  })

  it('picks the next slot the same day (summer, CEST = UTC+2)', () => {
    // 10:00 CEST -> 12:00 CEST = 10:00Z
    expect(iso(nextRunAfter(new Date('2026-07-15T08:00:00Z')))).toBe('2026-07-15T10:00:00.000Z')
  })

  it('is strictly after: a run computed exactly at a slot waits for the next one', () => {
    expect(iso(nextRunAfter(new Date('2026-07-15T10:00:00Z')))).toBe('2026-07-15T13:00:00.000Z')
  })

  it('rolls 18:xx over to 06:00 the next day (winter, CET = UTC+1)', () => {
    expect(iso(nextRunAfter(new Date('2026-12-10T17:30:00Z')))).toBe('2026-12-11T05:00:00.000Z')
  })

  it('rolls over before 06:00 to the same day 06:00', () => {
    expect(iso(nextRunAfter(new Date('2026-12-10T02:00:00Z')))).toBe('2026-12-10T05:00:00.000Z')
  })

  it('handles the spring-forward day (2026-03-29, 02:00 -> 03:00)', () => {
    // 06:00 CEST = 04:00Z; the evening before is still CET
    expect(iso(nextRunAfter(new Date('2026-03-28T17:30:00Z')))).toBe('2026-03-29T04:00:00.000Z')
    expect(iso(nextRunAfter(new Date('2026-03-29T04:30:00Z')))).toBe('2026-03-29T07:00:00.000Z')
  })

  it('handles the fall-back day (2026-10-25, 03:00 -> 02:00)', () => {
    // 06:00 CET = 05:00Z
    expect(iso(nextRunAfter(new Date('2026-10-24T17:30:00Z')))).toBe('2026-10-25T05:00:00.000Z')
    expect(iso(nextRunAfter(new Date('2026-10-25T05:30:00Z')))).toBe('2026-10-25T08:00:00.000Z')
  })

  it('crosses a month/year boundary', () => {
    expect(iso(nextRunAfter(new Date('2026-12-31T20:00:00Z')))).toBe('2027-01-01T05:00:00.000Z')
  })
})
