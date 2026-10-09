import { describe, it, expect } from 'vitest'
import type { TrailConditionResponse } from '~/types/Weather'
import { sampleTrailCondition } from './sampleCondition'

describe('sampleTrailCondition', () => {
  const now = new Date('2026-09-24T14:30:00Z')

  it('is the good-weather case: Hero Dirt', () => {
    // Typed against the wire contract, so the sample cannot drift out of step with the real card.
    const sample: TrailConditionResponse = sampleTrailCondition(now)

    expect(sample.verdict.level).toBe('prime')
    expect(sample.verdict.headline).toBe('Hero Dirt')
    expect(sample.rainRule).toEqual({ raining: false, hoursSinceRain: expect.any(Number) })
  })

  it('has the strip window the real card gets: today-2 … today+3, one today, forecast after it', () => {
    for (const day of ['2026-01-05T03:00:00Z', '2026-09-24T14:30:00Z', '2027-03-01T23:59:00Z']) {
      const at = new Date(day)
      const { strip } = sampleTrailCondition(at)
      const dates = strip.map((d) => d.date)
      const iso = (offset: number) => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + offset)).toISOString().slice(0, 10)

      expect(dates).toEqual([-2, -1, 0, 1, 2, 3].map(iso))
      expect(strip.filter((d) => d.isToday)).toHaveLength(1)
      expect(strip.find((d) => d.isToday)!.date).toBe(iso(0))
      expect(strip.map((d) => d.isForecast)).toEqual([false, false, false, true, true, true])
    }
  })

  it('carries a German weekday label and an icon per day', () => {
    // 2026-09-24 is a Thursday.
    const { strip } = sampleTrailCondition(now)

    expect(strip.map((d) => d.weekday)).toEqual(['Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
    for (const day of strip) expect(day.icon).not.toBe('')
  })

  it('shows some variety in the strip — a shower on the way', () => {
    const { strip } = sampleTrailCondition(now)

    expect(strip.filter((d) => d.isForecast).some((d) => d.precipitationMm > 0)).toBe(true)
  })

  it('is not real data: it does not depend on any spot', () => {
    expect(sampleTrailCondition(now)).toEqual(sampleTrailCondition(now))
  })
})
