import { describe, it, expect } from 'vitest'
import { buildSpotSeries, buildSpotRow, trimLeadingGaps } from './backtest'
import type { SoilProfile } from './sources'
import { BALANCE_WINDOW_HOURS } from '~/utils/trailCondition'

// A payload shaped like Open-Meteo's response, run through the REAL trail
// condition model — only the network is absent. 30 days: the last one is "today"
// and must not be evaluated, the first ten only feed the model's 10-day window.

const LAYER = 'soil_moisture_3_to_9cm'
const DAYS = 30
const WINDOW_DAYS = BALANCE_WINDOW_HOURS / 24

function date(i: number): string {
  return new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10)
}

function payload(
  opts: {
    stormDays?: number[]
    stormMm?: number
    nowRaining?: boolean
    withLayer?: boolean
    noMoistureDays?: number[]
    /** Days with no rain/snow/et0 data at all — the real API has these at the start of a 92-day request. */
    noRainDataDays?: number[]
  } = {},
) {
  const storms = new Set(opts.stormDays ?? [14])
  const noMoisture = new Set(opts.noMoistureDays ?? [])
  const noRainData = new Set(opts.noRainDataDays ?? [])
  const time: string[] = []
  const precipitation: (number | null)[] = []
  const snowfall: (number | null)[] = []
  const moisture: (number | null)[] = []
  for (let i = 0; i < DAYS; i++) {
    const sinceStorm = [...storms].filter((s) => s <= i).map((s) => i - s)
    const age = sinceStorm.length ? Math.min(...sinceStorm) : 99
    for (let h = 0; h < 24; h++) {
      time.push(`${date(i)}T${String(h).padStart(2, '0')}:00`)
      precipitation.push(noRainData.has(i) ? null : storms.has(i) && h === 12 ? (opts.stormMm ?? 20) : 0)
      snowfall.push(noRainData.has(i) ? null : 0)
      moisture.push(noMoisture.has(i) ? null : 0.15 + 0.2 * Math.exp(-age * 0.25))
    }
  }
  const dates = Array.from({ length: DAYS }, (_, i) => date(i))
  return {
    utc_offset_seconds: 7200,
    timezone: 'Europe/Berlin',
    elevation: 413,
    current: {
      temperature_2m: 17,
      apparent_temperature: 16,
      weather_code: 61,
      precipitation: opts.nowRaining ? 2.4 : 0,
      wind_speed_10m: 12,
    },
    daily: {
      time: dates,
      weather_code: dates.map((_, i) => (noRainData.has(i) ? null : 3)),
      precipitation_sum: dates.map((_, i) => (noRainData.has(i) ? null : storms.has(i) ? (opts.stormMm ?? 20) : 0)),
      temperature_2m_max: dates.map((_, i) => (noRainData.has(i) ? null : 20)),
      temperature_2m_min: dates.map((_, i) => (noRainData.has(i) ? null : 10)),
      et0_fao_evapotranspiration: dates.map((_, i) => (noRainData.has(i) ? null : 2)),
      snowfall_sum: dates.map((_, i) => (noRainData.has(i) ? null : 0)),
    },
    hourly: {
      time,
      precipitation,
      snowfall,
      ...(opts.withLayer === false ? {} : { [LAYER]: moisture }),
    },
  }
}

describe('buildSpotSeries', () => {
  it('starts once the model has a full 10-day window and stops before today', () => {
    const result = buildSpotSeries(payload(), LAYER)

    // Days 0-9 only feed the window; the last day (29) is today, still incomplete.
    expect(result.series.dates[0]).toBe(date(WINDOW_DAYS))
    expect(result.series.dates.at(-1)).toBe(date(DAYS - 2))
    expect(result.series.dates).toHaveLength(DAYS - 1 - WINDOW_DAYS)
  })

  it('keeps every per-day series the same length, one entry per evaluated day', () => {
    const { series, levels } = buildSpotSeries(payload(), LAYER)

    expect(series.rainMm).toHaveLength(series.dates.length)
    expect(series.moisture).toHaveLength(series.dates.length)
    expect(series.bucketMm).toHaveLength(series.dates.length)
    expect(levels).toHaveLength(series.dates.length)
  })

  it("carries the chosen layer's daily mean moisture and the day's rain", () => {
    const { series } = buildSpotSeries(payload({ stormDays: [14], stormMm: 20 }), LAYER)
    const i = series.dates.indexOf(date(14))

    expect(series.rainMm[i]).toBe(20)
    // The synthetic moisture is constant within a day, so its mean is that value.
    expect(series.moisture[i]).toBeCloseTo(0.35, 3)
  })

  it('runs the real model: the bucket fills after a storm and drains afterwards', () => {
    const { series } = buildSpotSeries(payload({ stormDays: [14], stormMm: 20 }), LAYER)
    const before = series.bucketMm[series.dates.indexOf(date(13))]!
    const after = series.bucketMm[series.dates.indexOf(date(15))]!
    const later = series.bucketMm[series.dates.indexOf(date(24))]!

    expect(before).toBe(0)
    expect(after).toBeGreaterThan(5) // 20 mm on dry ground, 30% runs off
    expect(later).toBeLessThan(after)
  })

  it('ignores rain right now, so a live drizzle does not turn every backtest day into "raining"', () => {
    const { levels } = buildSpotSeries(payload({ nowRaining: true }), LAYER)

    expect(levels).not.toContain('raining')
    expect(levels.length).toBeGreaterThan(0)
  })

  it('starts at the first complete soil-moisture day when the layer only begins later', () => {
    // Real Open-Meteo behaviour: rain history reaches back 92 days but the moisture
    // layers only start on 2026-07-17 — 66 days. Days 0-17 have rain but no moisture.
    const noMoistureDays = Array.from({ length: 18 }, (_, i) => i)

    const { series } = buildSpotSeries(payload({ noMoistureDays }), LAYER)

    expect(series.dates[0]).toBe(date(18))
    expect(series.dates.at(-1)).toBe(date(DAYS - 2))
    expect(series.moisture.every((m) => Number.isFinite(m))).toBe(true)
  })

  // Real Open-Meteo behaviour found by the first live run: a 92-day request has no
  // rain, snow or et0 for its first ~19 days. The trail model treats ONE missing
  // value anywhere as "unusable", so without trimming every evaluated day came
  // back "unknown" and the whole report was silently empty.
  it('trims a leading gap in the rain data so the model does not answer "unknown" for every day', () => {
    const noRainDataDays = Array.from({ length: 9 }, (_, i) => i) // days 0-8 empty, day 9 is the first with data

    const { series, levels } = buildSpotSeries(payload({ noRainDataDays }), LAYER)

    // First complete day is 9; the 10-day window is full from day 19.
    expect(series.dates[0]).toBe(date(9 + WINDOW_DAYS))
    expect(levels).not.toContain('unknown')
    expect(series.bucketMm.some((b) => b > 0)).toBe(true)
  })

  it('starts after whichever comes later: a full rain window or the first moisture day', () => {
    const noRainDataDays = Array.from({ length: 9 }, (_, i) => i) // window full on day 19
    const noMoistureDays = Array.from({ length: 22 }, (_, i) => i) // moisture starts day 22

    const { series } = buildSpotSeries(payload({ noRainDataDays, noMoistureDays }), LAYER)

    expect(series.dates[0]).toBe(date(22))
  })

  it('fails loudly when trimming leaves too little data to evaluate anything', () => {
    // A hole late in the payload leaves fewer than a full window after it.
    expect(() => buildSpotSeries(payload({ noRainDataDays: Array.from({ length: 24 }, (_, i) => i) }), LAYER)).toThrow(
      /not enough|no complete/i,
    )
  })

  it('refuses a hole in the middle of the moisture series — a gap would corrupt every dry-down after it', () => {
    expect(() => buildSpotSeries(payload({ noMoistureDays: [20] }), LAYER)).toThrow(/No complete soil-moisture day/)
  })

  it('says so when no day has moisture at all, instead of returning an empty series', () => {
    const noMoistureDays = Array.from({ length: DAYS }, (_, i) => i)

    expect(() => buildSpotSeries(payload({ noMoistureDays }), LAYER)).toThrow(/no complete soil-moisture/i)
  })

  it('throws a clear error when the payload has no such soil-moisture layer', () => {
    expect(() => buildSpotSeries(payload({ withLayer: false }), LAYER)).toThrow(/soil_moisture_3_to_9cm/)
  })

  it('throws when the payload is unusable for the model instead of returning an empty backtest', () => {
    expect(() => buildSpotSeries({ hourly: {} }, LAYER)).toThrow(/payload/i)
  })
})

// ── trimLeadingGaps ────────────────────────────────────────────────────────

describe('trimLeadingGaps', () => {
  it('cuts the empty days off the front of every hourly and daily array, keeping them aligned', () => {
    const raw = payload({ noRainDataDays: [0, 1, 2] }) as ReturnType<typeof payload>

    const trimmed = trimLeadingGaps(raw) as ReturnType<typeof payload>

    expect(trimmed.daily.time[0]).toBe(date(3))
    expect(trimmed.daily.time).toHaveLength(DAYS - 3)
    expect(trimmed.daily.et0_fao_evapotranspiration).toHaveLength(DAYS - 3)
    expect(trimmed.hourly.time[0]).toBe(`${date(3)}T00:00`)
    expect(trimmed.hourly.time).toHaveLength((DAYS - 3) * 24)
    // The soil-moisture layer is cut at the same hour, not left at full length.
    expect((trimmed.hourly as Record<string, unknown[]>)[LAYER]).toHaveLength((DAYS - 3) * 24)
    expect(trimmed.hourly.precipitation.every((v) => typeof v === 'number')).toBe(true)
  })

  it('leaves a payload without gaps exactly as it is', () => {
    const raw = payload()

    expect(trimLeadingGaps(raw)).toEqual(raw)
  })

  it('does not mutate what it was given', () => {
    const raw = payload({ noRainDataDays: [0, 1] })
    const before = JSON.stringify(raw)

    trimLeadingGaps(raw)

    expect(JSON.stringify(raw)).toBe(before)
  })

  it('treats a hole in the middle as the start of the clean part — everything before it is dropped', () => {
    const trimmed = trimLeadingGaps(payload({ noRainDataDays: [10] })) as ReturnType<typeof payload>

    expect(trimmed.daily.time[0]).toBe(date(11))
  })

  it('throws when not a single day is complete', () => {
    const all = Array.from({ length: DAYS }, (_, i) => i)

    expect(() => trimLeadingGaps(payload({ noRainDataDays: all }))).toThrow(/no complete/i)
  })
})

// ── buildSpotRow ───────────────────────────────────────────────────────────

const LOAM: SoilProfile = {
  clay: 24.4, clayQ05: 1.3, clayQ95: 75.3, sand: 33.3, silt: 42.2,
  cfvo: 13, soc: 26.7, wv0010: 0.423, wv0033: 0.342, wv1500: 0.178,
}
const SPOT = { name: 'Bärenleite - Trails', latitude: 49.9128, longitude: 11.5604, totalClicks: 514 }

describe('buildSpotRow', () => {
  it('joins the soil profile, the moisture statistics and the model levels into one row', () => {
    const result = buildSpotSeries(payload({ stormDays: [14] }), LAYER)

    const row = buildSpotRow(SPOT, LOAM, result)

    expect(row.spot.name).toBe('Bärenleite - Trails')
    // The period the numbers rest on travels with them, so a report can say "Jul 19 – Sep 19".
    expect(row.period).toEqual({ from: result.series.dates[0], to: result.series.dates.at(-1) })
    expect(row.texture).toBe('loam')
    expect(row.stats.days).toBe(result.series.dates.length)
    // Every evaluated day lands in exactly one level.
    expect(Object.values(row.levels).reduce((a, b) => a + b, 0)).toBe(result.series.dates.length)
  })

  it('passes the dry-down thresholds through, so a short summer can be searched more loosely', () => {
    const result = buildSpotSeries(payload({ stormDays: [14], stormMm: 20 }), LAYER)

    const strict = buildSpotRow(SPOT, LOAM, result, { stormMm: 50 })
    const normal = buildSpotRow(SPOT, LOAM, result)

    // A 20 mm storm is not a storm at a 50 mm threshold.
    expect(strict.stats.rainEvents).toBe(0)
    expect(normal.stats.rainEvents).toBeGreaterThan(0)
  })

  it('records where each verdict sits inside the spot\'s own moisture range', () => {
    const result = buildSpotSeries(payload({ stormDays: [14] }), LAYER)

    const row = buildSpotRow(SPOT, LOAM, result)

    // Every level the model produced has a position; none is invented.
    expect(Object.keys(row.moistureByLevel).sort()).toEqual(Object.keys(row.levels).sort())
  })

  it("expresses moisture against the soil's own wilting point and field capacity", () => {
    const result = buildSpotSeries(payload({ stormDays: [14] }), LAYER)

    const row = buildSpotRow(SPOT, LOAM, result)

    // Median synthetic moisture ~0.15-0.2; wilting 0.178, field capacity 0.342.
    expect(row.relSaturation).not.toBeNull()
    expect(row.relSaturation!).toBeGreaterThan(-0.5)
    expect(row.relSaturation!).toBeLessThan(1)
    // Peak 0.35 is above the 0.342 field capacity on the storm days only.
    expect(row.pctDaysAboveFieldCapacity!).toBeGreaterThan(0)
    expect(row.pctDaysAboveFieldCapacity!).toBeLessThan(50)
  })

  it('still produces a row when SoilGrids failed, with the soil-dependent columns empty', () => {
    const result = buildSpotSeries(payload({ stormDays: [14] }), LAYER)

    const row = buildSpotRow(SPOT, null, result)

    expect(row.texture).toBeNull()
    expect(row.relSaturation).toBeNull()
    expect(row.pctDaysAboveFieldCapacity).toBeNull()
    expect(row.stats.days).toBeGreaterThan(0)
  })
})
