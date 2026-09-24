import { describe, it, expect } from 'vitest'
import { sampleSpotWeather } from './sampleWeather'
import { computeTrailCondition, todayIndex } from './trailCondition'
import { weatherCodeLabel } from './weatherCodes'

describe('sampleSpotWeather', () => {
  const now = new Date('2026-09-24T14:30:00Z')

  it('is the good-weather case: sunny right now, and the model calls the ground Hero Dirt', () => {
    const weather = sampleSpotWeather(now)

    expect(weatherCodeLabel(weather.current.weatherCode)).toBe('Klar')
    // Run through the REAL model, so the sample can never drift out of step with it.
    const condition = computeTrailCondition(weather, 'soil', now)
    expect(condition.level).toBe('prime')
    expect(condition.headline).toBe('Hero Dirt')
  })

  it('puts today where the strip expects it, with three days ahead, whatever day it is built on', () => {
    for (const day of ['2026-01-05T03:00:00Z', '2026-09-24T14:30:00Z', '2027-03-01T23:59:00Z']) {
      const at = new Date(day)
      const weather = sampleSpotWeather(at)

      expect(weather.days[todayIndex(weather, at)]!.date).toBe(at.toISOString().slice(0, 10))
      expect(weather.days.length - 1 - todayIndex(weather, at)).toBe(3)
      // Still Hero Dirt in midwinter — the sample is a fixed story, not real weather.
      expect(computeTrailCondition(weather, 'soil', at).headline).toBe('Hero Dirt')
    }
  })

  it('is a complete payload the model accepts — never "unknown"', () => {
    const weather = sampleSpotWeather(now)

    expect(computeTrailCondition(weather, 'soil', now).level).not.toBe('unknown')
    expect(weather.hourly.precipitationMm).toHaveLength(weather.hourly.time.length)
    expect(weather.hourly.snowfallCm).toHaveLength(weather.hourly.time.length)
  })

  it('shows some variety in the strip — a shower on the way — without spoiling the verdict', () => {
    const weather = sampleSpotWeather(now)
    const ahead = weather.days.slice(todayIndex(weather, now) + 1)

    expect(ahead.some((d) => d.precipitationMm > 0)).toBe(true)
    // Forecast rain is never evidence about the ground.
    expect(computeTrailCondition(weather, 'soil', now).level).toBe('prime')
  })

  it('is not real data: it does not depend on any spot', () => {
    expect(sampleSpotWeather(now)).toEqual(sampleSpotWeather(now))
  })
})
