import { describe, it, expect } from 'vitest'
import eberbachPayload from './__fixtures__/eberbach-2026-09-20.json'
import type { SpotWeather, DayWeather } from '~/types/Weather'
import type { Trail, DirtPark } from '~/types/Trail'
import { mapWeatherResponse } from '~/communication/weather'
import { computeTrailCondition, conditionModeFor, THRESHOLD_DUST_DRYING_MM } from './trailCondition'

// ── Fixture builder ────────────────────────────────────────────────────────
// Mirrors the real Open-Meteo shape: offset-less local timestamps plus a
// separate utc_offset_seconds, daily aggregates alongside hourly series.
// Rain for a day lands in one hour (12:00 local) so the arithmetic in these
// tests is checkable by hand.

const TZ_OFFSET = 7200 // Europe/Berlin, CEST

interface DaySpec {
  date: string
  precipMm?: number
  et0Mm?: number
  snowCm?: number
  tempMax?: number
  tempMin?: number
  code?: number
}

function buildWeather(spec: {
  days: DaySpec[]
  currentPrecipMm?: number
  temperature?: number
  currentCode?: number
}): SpotWeather {
  const days: DayWeather[] = spec.days.map((d) => ({
    date: d.date,
    weatherCode: d.code ?? 2,
    precipitationMm: d.precipMm ?? 0,
    snowfallCm: d.snowCm ?? 0,
    tempMax: d.tempMax ?? 18,
    tempMin: d.tempMin ?? 9,
    et0Mm: d.et0Mm ?? 2,
  }))

  const time: string[] = []
  const precipitationMm: number[] = []
  const snowfallCm: number[] = []
  for (const d of spec.days) {
    for (let h = 0; h < 24; h++) {
      time.push(`${d.date}T${String(h).padStart(2, '0')}:00`)
      precipitationMm.push(h === 12 ? (d.precipMm ?? 0) : 0)
      snowfallCm.push(h === 12 ? (d.snowCm ?? 0) : 0)
    }
  }

  return {
    current: {
      temperature: spec.temperature ?? 12,
      apparentTemperature: (spec.temperature ?? 12) - 2,
      weatherCode: spec.currentCode ?? 2,
      precipitationMm: spec.currentPrecipMm ?? 0,
      windKmh: 13,
    },
    days,
    hourly: { time, precipitationMm, snowfallCm },
    utcOffsetSeconds: TZ_OFFSET,
    timezone: 'Europe/Berlin',
    elevation: 693,
  }
}

const DATES = ['2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']
/** 2026-09-17 18:00 local (CEST) — the evening of the last day in the payload. */
const NOW = new Date('2026-09-17T16:00:00Z')

/**
 * The payload actually returned by Open-Meteo for Winterberg (51.19/8.52) on
 * 2026-09-17, copied from the live response: 13.4mm on the 13th, then four
 * mild days with 1.1mm on the 16th.
 */
const WINTERBERG_PRECIP = [0, 13.4, 0, 0, 1.1, 0]
const WINTERBERG_ET0 = [2.01, 0.61, 2.03, 2.58, 1.73, 1.61]

function winterbergDays(et0: number[] = WINTERBERG_ET0): DaySpec[] {
  return DATES.map((date, i) => ({
    date,
    precipMm: WINTERBERG_PRECIP[i],
    et0Mm: et0[i],
    tempMax: 18,
  }))
}

describe('computeTrailCondition — water balance', () => {
  it('calls a week without any rain staubtrocken', () => {
    const weather = buildWeather({
      days: DATES.map((date) => ({ date, precipMm: 0, et0Mm: 4.2, tempMax: 27 })),
      temperature: 27,
    })

    const condition = computeTrailCondition(weather, 'soil', NOW)

    expect(condition.level).toBe('dusty')
    expect(condition.headline).toBe('Staubtrocken')
    expect(condition.hoursSinceRain).toBeNull()
  })

  it('still calls the real Winterberg payload feucht — 13.4mm, four mild days later', () => {
    // At DRYING_FACTOR 1.0 this read "Griffig". Halving the drying rate (the
    // FAO reference rate describes open grassland, not a trail under canopy)
    // moves it one band wetter, which is the intended recalibration.
    const condition = computeTrailCondition(buildWeather({ days: winterbergDays() }), 'soil', NOW)

    expect(condition.level).toBe('damp')
    expect(condition.headline).toBe('Feucht, aber fahrbar')
    // 13.4mm fell at 12:00 on the 13th; "now" is 18:00 on the 17th.
    expect(condition.hoursSinceRain).toBe(30)
  })

  it('reaches a different verdict for the same rainfall in July and December', () => {
    // Identical precipitation, only evapotranspiration changes. If these came
    // out the same, the whole water balance would be pointless and a plain
    // 72h rain sum would do.
    const rain = (et0: number) =>
      DATES.map((date, i) => ({ date, precipMm: i === DATES.length - 2 ? 15 : 0, et0Mm: et0 }))

    const july = computeTrailCondition(buildWeather({ days: rain(4.5) }), 'soil', NOW)
    const december = computeTrailCondition(buildWeather({ days: rain(0.4) }), 'soil', NOW)

    expect(july.level).toBe('damp')
    expect(december.level).toBe('wet')
    expect(december.wetnessMm).toBeGreaterThan(july.wetnessMm)
  })

  it('calls a soaked November week nass und weich', () => {
    const condition = computeTrailCondition(
      buildWeather({
        days: DATES.map((date, i) => ({
          date,
          precipMm: [0, 0, 0, 14, 13, 13][i],
          et0Mm: 0.4,
          tempMax: 6,
        })),
        temperature: 6,
      }),
      'soil',
      NOW,
    )

    expect(condition.level).toBe('wet')
    expect(condition.headline).toBe('Nass und weich')
    // The evidence figure must be the measured rainfall of the last 3 days,
    // not the runoff-reduced amount the bucket works with.
    expect(condition.detail).toContain('40 mm')
  })

  it('calls a moderate recent soaking feucht', () => {
    const condition = computeTrailCondition(
      buildWeather({
        days: DATES.map((date, i) => ({ date, precipMm: [0, 0, 0, 0, 7, 4][i], et0Mm: WINTERBERG_ET0[i] })),
      }),
      'soil',
      NOW,
    )

    expect(condition.level).toBe('damp')
    expect(condition.headline).toBe('Feucht, aber fahrbar')
  })
})

describe('computeTrailCondition — overrides', () => {
  it('reports falling rain regardless of how dry the ground was', () => {
    const condition = computeTrailCondition(
      buildWeather({
        days: DATES.map((date) => ({ date, precipMm: 0, et0Mm: 4.2, tempMax: 26 })),
        currentPrecipMm: 0.4,
        currentCode: 63,
      }),
      'soil',
      NOW,
    )

    expect(condition.level).toBe('raining')
    expect(condition.headline).toBe('Es regnet gerade')
    expect(condition.detail).toContain('0,4 mm/h')
  })

  it('reports fresh snow ahead of the water balance', () => {
    const condition = computeTrailCondition(
      buildWeather({
        days: DATES.map((date, i) => ({
          date,
          precipMm: [0, 0, 0, 12, 10, 0][i],
          snowCm: i === 5 ? 4 : 0,
          et0Mm: 0.3,
          tempMax: -2,
        })),
        temperature: -3,
      }),
      'soil',
      NOW,
    )

    expect(condition.level).toBe('snow')
    expect(condition.headline).toBe('Schnee & Frost')
    expect(condition.detail).toContain('4 cm Neuschnee')
  })

  it('reports hard frost as snow even without fresh snowfall', () => {
    const condition = computeTrailCondition(
      buildWeather({
        days: DATES.map((date) => ({ date, precipMm: 0, et0Mm: 0.2, tempMax: -4 })),
        temperature: -6,
      }),
      'soil',
      NOW,
    )

    expect(condition.level).toBe('snow')
    expect(condition.detail).toContain('Dauerfrost')
  })

  it('gives a sealed-surface spot current weather instead of a soil verdict', () => {
    const condition = computeTrailCondition(
      buildWeather({ days: winterbergDays(), temperature: 12, currentCode: 2 }),
      'hard',
      NOW,
    )

    expect(condition.level).toBe('hard')
    expect(condition.headline).toBe('12°, teilweise bewölkt')
    expect(condition.detail).toContain('Asphalt trocknet in Minuten')
  })

  it('still reports falling rain on a sealed surface', () => {
    const condition = computeTrailCondition(
      buildWeather({ days: winterbergDays(), currentPrecipMm: 1.2 }),
      'hard',
      NOW,
    )

    expect(condition.level).toBe('raining')
  })
})

describe('computeTrailCondition — unusable payloads', () => {
  it('returns unknown rather than guessing when the payload is null', () => {
    expect(computeTrailCondition(null, 'soil', NOW).level).toBe('unknown')
  })

  it('returns unknown when the hourly precipitation series has a gap', () => {
    const weather = buildWeather({ days: winterbergDays() })
    // Open-Meteo emits null for hours a model has no value for.
    ;(weather.hourly.precipitationMm as unknown as (number | null)[])[40] = null

    expect(computeTrailCondition(weather, 'soil', NOW).level).toBe('unknown')
  })

  it('returns unknown when hourly arrays are of unequal length', () => {
    const weather = buildWeather({ days: winterbergDays() })
    weather.hourly.snowfallCm.pop()

    expect(computeTrailCondition(weather, 'soil', NOW).level).toBe('unknown')
  })

  it('does not throw on an empty day list', () => {
    const weather = buildWeather({ days: winterbergDays() })
    weather.days = []

    expect(() => computeTrailCondition(weather, 'soil', NOW)).not.toThrow()
    expect(computeTrailCondition(weather, 'soil', NOW).level).toBe('unknown')
  })
})

describe('conditionModeFor', () => {
  function dirtpark(overrides: Partial<DirtPark>): Trail {
    return { type: 'dirtpark', pumptrack: false, dirtpark: true, ...overrides } as DirtPark
  }

  it('gives trails and bikeparks a soil verdict', () => {
    expect(conditionModeFor({ type: 'trail' } as Trail)).toBe('soil')
    expect(conditionModeFor({ type: 'bikepark' } as Trail)).toBe('soil')
  })

  it('treats an asphalt-only pumptrack as a hard surface', () => {
    expect(conditionModeFor(dirtpark({ pumptrack: true, dirtpark: false }))).toBe('hard')
  })

  it('treats a dirt jump line as soil, even when a pumptrack shares the spot', () => {
    expect(conditionModeFor(dirtpark({ pumptrack: true, dirtpark: true }))).toBe('soil')
    expect(conditionModeFor(dirtpark({ pumptrack: false, dirtpark: true }))).toBe('soil')
  })
})

// ── Regression: real payload, reported as implausible ────────────────────
// Reported from the live app on 2026-09-20: Bikeländ Eberbach showed
// "Staubtrocken" four days after 5.7mm of rain, in September, at 20–24°C.
// A rider's read of the same trail was "pretty grippy, almost perfect".
//
// The cause was not a threshold. The bucket was clamped at zero, so it forgot
// everything once the surplus ran out — "the rain finished draining
// yesterday" and "no rain for three weeks in August" both scored 0.0, and both
// came out Staubtrocken. Dust needs an accumulated moisture *deficit*, which a
// bucket floored at zero can never represent.
//
// The fixture is the unmodified Open-Meteo response for the spot's real
// coordinates at the moment it was reported.
describe('computeTrailCondition — Eberbach regression', () => {
  const raw = eberbachPayload
  /** 2026-09-20 08:45 local (CEST) — when the card was looked at. */
  const OBSERVED_AT = new Date('2026-09-20T06:45:00Z')

  it('calls it griffig, not staubtrocken, four days after 5.7mm in September', () => {
    const condition = computeTrailCondition(mapWeatherResponse(raw), 'soil', OBSERVED_AT)

    expect(condition.level).toBe('prime')
    expect(condition.headline).toBe('Griffig')
  })

  it('has drained its surplus but has nowhere near enough drying for dust', () => {
    const condition = computeTrailCondition(mapWeatherResponse(raw), 'soil', OBSERVED_AT)

    // Free water gone (so wetnessMm reports the drying side, i.e. <= 0), but
    // four mild September days are well short of the dust threshold.
    expect(condition.wetnessMm).toBeLessThanOrEqual(0)
    expect(Math.abs(condition.wetnessMm)).toBeLessThan(THRESHOLD_DUST_DRYING_MM)
    expect(condition.hoursSinceRain).toBe(86)
  })
})
