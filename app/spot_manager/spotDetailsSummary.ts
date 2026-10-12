import type { ParkDetailsRow, SpotStatus } from './Api'

const MAX_HOURS_CHARS = 40

// Status key driving the banner dot; legacy/unknown park values read as open.
export function parkStatusKey(d: ParkDetailsRow | null): Extract<SpotStatus, 'open' | 'closed'> {
  return d?.status === 'closed' ? 'closed' : 'open'
}

export function parkBannerSub(d: ParkDetailsRow | null): string {
  if (!d) return 'Nicht konfiguriert'
  const parts = [parkStatusKey(d) === 'closed' ? 'Gesperrt' : 'Offen']
  const hours = (d.opening_hours ?? '').replace(/\s+/g, ' ').trim()
  if (hours) parts.push(hours.length > MAX_HOURS_CHARS ? `${hours.slice(0, MAX_HOURS_CHARS - 1)}…` : hours)
  return parts.join(' · ')
}
