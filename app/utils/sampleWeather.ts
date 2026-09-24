import type { SpotWeather, DayWeather } from '~/types/Weather'

/**
 * A fixed, made-up weather payload for the locked Trail-Zustand teaser: sunny,
 * mild, a few dry days after a proper rain — the best case, which the real model
 * calls "Hero Dirt". Built relative to `now` so the strip's "Heute" column and its
 * three forecast days sit where the real card puts them, on any day of the year.
 *
 * It is not about any spot and it is not fetched, so showing it costs no
 * Open-Meteo request and reveals nothing. Pure on purpose: no Date.now(), no
 * imports from communication/ or stores/ — the same rule as trailCondition.ts,
 * and it feeds that module unchanged, so the sample cannot drift out of step
 * with the model.
 */

const DAYS_BACK = 10
const DAYS_AHEAD = 3
/** 5.7 mm five days ago: enough to matter, long enough ago to have dried out. */
const RAIN_DAY = -5
const RAIN_MM = 5.7

function isoDay(now: Date, offset: number): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset))
    .toISOString()
    .slice(0, 10)
}

// Sky per day, from ten days back to three ahead: clear, then a shower on the way.
function weatherCodeFor(offset: number): number {
  if (offset === RAIN_DAY) return 61
  if (offset === 0) return 0
  if (offset === 2) return 80
  if (offset > 0) return 1
  return offset % 2 === 0 ? 1 : 2
}

export function sampleSpotWeather(now: Date = new Date()): SpotWeather {
  const days: DayWeather[] = []
  const time: string[] = []
  const precipitationMm: number[] = []
  const snowfallCm: number[] = []

  for (let offset = -DAYS_BACK; offset <= DAYS_AHEAD; offset++) {
    const date = isoDay(now, offset)
    const rainDay = offset === RAIN_DAY
    // A light shower two days out shows up in the strip as a hollow bar; being a
    // forecast it never counts against the ground.
    const dayMm = rainDay ? RAIN_MM : offset === 2 ? 1.2 : 0
    days.push({
      date,
      weatherCode: weatherCodeFor(offset),
      precipitationMm: dayMm,
      snowfallCm: 0,
      tempMax: 21,
      tempMin: 10,
      et0Mm: 2.2,
    })
    for (let hour = 0; hour < 24; hour++) {
      time.push(`${date}T${String(hour).padStart(2, '0')}:00`)
      // The day's rain falls at noon, as in the model's own test fixtures.
      precipitationMm.push(hour === 12 ? dayMm : 0)
      snowfallCm.push(0)
    }
  }

  return {
    current: {
      temperature: 21,
      apparentTemperature: 20,
      weatherCode: 0,
      precipitationMm: 0,
      windKmh: 9,
    },
    days,
    hourly: { time, precipitationMm, snowfallCm },
    utcOffsetSeconds: 0,
    timezone: 'UTC',
    elevation: 400,
  }
}
