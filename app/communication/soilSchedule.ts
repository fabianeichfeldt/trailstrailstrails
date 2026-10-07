/** Hours (Europe/Berlin) at which the backend refreshes the soil snapshot. */
export const SOIL_RUN_HOURS = [7, 12, 16]

const TZ = 'Europe/Berlin'
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

// Berlin wall-clock fields of an instant, as a UTC-based ms value (offset-free).
function wallMs(instant: number): number {
  const p: Record<string, number> = {}
  for (const { type, value } of fmt.formatToParts(new Date(instant))) p[type] = Number(value)
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!)
}

// Berlin wall-clock (as UTC-based ms) -> real instant; second pass corrects across a DST edge.
function berlinToInstant(wall: number): number {
  let guess = wall - (wallMs(wall) - wall)
  guess = wall - (wallMs(guess) - guess)
  return guess
}

/** First scheduled run strictly after `computedAt` (DST-aware; 16:xx -> next day 07:00). */
export function nextRunAfter(computedAt: Date): Date {
  const t = computedAt.getTime()
  const day = new Date(wallMs(t))
  day.setUTCHours(0, 0, 0, 0)
  for (let d = 0; d < 3; d++) {
    for (const h of SOIL_RUN_HOURS) {
      const instant = berlinToInstant(day.getTime() + (d * 24 + h) * 3_600_000)
      if (instant > t) return new Date(instant)
    }
  }
  /* c8 ignore next */
  return new Date(t + 3 * 3_600_000)
}
