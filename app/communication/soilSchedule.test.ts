import { describe, it, expect } from 'vitest'
import { nextRunAfter, SOIL_RUN_HOURS } from './soilSchedule'

const iso = (d: Date) => d.toISOString()

describe('nextRunAfter', () => {
  it('runs at 07/12/16 Berlin', () => {
    expect(SOIL_RUN_HOURS).toEqual([7, 12, 16])
  })

  it('picks the next slot the same day (summer, CEST = UTC+2)', () => {
    // 10:00 CEST -> 12:00 CEST = 10:00Z
    expect(iso(nextRunAfter(new Date('2026-07-15T08:00:00Z')))).toBe('2026-07-15T10:00:00.000Z')
  })

  it('is strictly after: a run computed exactly at a slot waits for the next one', () => {
    expect(iso(nextRunAfter(new Date('2026-07-15T10:00:00Z')))).toBe('2026-07-15T14:00:00.000Z')
  })

  it('rolls 16:xx over to 07:00 the next day (winter, CET = UTC+1)', () => {
    expect(iso(nextRunAfter(new Date('2026-12-10T15:30:00Z')))).toBe('2026-12-11T06:00:00.000Z')
  })

  it('rolls over before 07:00 to the same day 07:00', () => {
    expect(iso(nextRunAfter(new Date('2026-12-10T02:00:00Z')))).toBe('2026-12-10T06:00:00.000Z')
  })

  it('handles the spring-forward day (2026-03-29, 02:00 -> 03:00)', () => {
    // 07:00 CEST = 05:00Z; the evening before is still CET
    expect(iso(nextRunAfter(new Date('2026-03-28T15:30:00Z')))).toBe('2026-03-29T05:00:00.000Z')
    expect(iso(nextRunAfter(new Date('2026-03-29T05:30:00Z')))).toBe('2026-03-29T10:00:00.000Z')
  })

  it('handles the fall-back day (2026-10-25, 03:00 -> 02:00)', () => {
    // 07:00 CET = 06:00Z; the afternoon before is still CEST
    expect(iso(nextRunAfter(new Date('2026-10-24T14:30:00Z')))).toBe('2026-10-25T06:00:00.000Z')
    expect(iso(nextRunAfter(new Date('2026-10-25T06:30:00Z')))).toBe('2026-10-25T11:00:00.000Z')
  })

  it('crosses a month/year boundary', () => {
    expect(iso(nextRunAfter(new Date('2026-12-31T20:00:00Z')))).toBe('2027-01-01T06:00:00.000Z')
  })
})
