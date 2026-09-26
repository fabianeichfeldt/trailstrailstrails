import type { TrailConditionResponse } from '~/types/Weather'

/**
 * A fixed, made-up view-model for the locked Trail-Zustand teaser: sunny, mild,
 * a few dry days after a proper rain — the best case, "Hero Dirt". Built
 * relative to `now` so the strip's "Heute" column and its three forecast days sit
 * where the real card puts them, on any day of the year.
 *
 * It is not about any spot and it is not fetched, so showing it costs no request
 * and reveals nothing — and it holds no model, only the finished strings. Typed
 * as `TrailConditionResponse`, so it cannot drift from what the real card
 * renders. Pure on purpose: no Date.now().
 */

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const PAST_DAYS = 2
const FUTURE_DAYS = 3
/** Rain 5 days ago: enough to matter, long enough ago to have dried out. */
const RAIN_10D_MM = 5.7
const HOURS_SINCE_RAIN = 5 * 24 + 12

function dayAt(now: Date, offset: number): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset))
}

export function sampleTrailCondition(now: Date = new Date()): TrailConditionResponse {
  const strip: TrailConditionResponse['strip'] = []
  for (let offset = -PAST_DAYS; offset <= FUTURE_DAYS; offset++) {
    const date = dayAt(now, offset)
    strip.push({
      date: date.toISOString().slice(0, 10),
      weekday: WEEKDAYS[date.getUTCDay()]!,
      // Sunny, with a light shower two days out: shows up as a hollow bar.
      icon: offset === 2 ? '🌦️' : offset === 0 ? '☀️' : '🌤️',
      precipitationMm: offset === 2 ? 1.2 : 0,
      isToday: offset === 0,
      isForecast: offset > 0,
    })
  }

  return {
    verdict: {
      level: 'prime',
      headline: 'Hero Dirt',
      detail: `Bester Zustand. Seit ${HOURS_SINCE_RAIN} Stunden kein Regen, Boden weitgehend abgetrocknet.`,
      rain10dMm: RAIN_10D_MM,
    },
    rainRule: { raining: false, hoursSinceRain: HOURS_SINCE_RAIN },
    current: { temperature: 21, apparentTemperature: 20, icon: '☀️', windKmh: 9 },
    strip,
    fetchedAt: now.toISOString(),
  }
}
