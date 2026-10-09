import { describe, it, expect } from 'vitest'
import { formatStand } from './formatStand'

// 2026-10-07 is a Wednesday; 13:30Z is 15:30 in Berlin (CEST).
const NOW = new Date('2026-10-07T13:30:00Z')

describe('formatStand', () => {
  it('shows only the Berlin time for today', () => {
    expect(formatStand('2026-10-07T13:00:00Z', NOW)).toBe('Stand 15:00')
  })

  it('adds the short weekday for another day', () => {
    expect(formatStand('2026-10-05T16:00:00Z', NOW)).toBe('Stand Mo 18:00')
  })

  it('decides "today" in Berlin, not UTC', () => {
    // 22:30Z on the 6th is already 00:30 on the 7th in Berlin.
    expect(formatStand('2026-10-06T22:30:00Z', NOW)).toBe('Stand 00:30')
  })

  it('is empty for an unparseable timestamp', () => {
    expect(formatStand('not a date', NOW)).toBe('')
  })
})
