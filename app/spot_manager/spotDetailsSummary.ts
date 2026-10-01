import type { BikeParkDetailsRow, SpotStatus } from './Api'

const MAX_HOURS_CHARS = 40

// Status key driving the banner dot; legacy/unknown bikepark values read as open.
export function bikeParkStatusKey(d: BikeParkDetailsRow | null): Extract<SpotStatus, 'open' | 'closed'> {
  return d?.status === 'closed' ? 'closed' : 'open'
}

export function bikeParkBannerSub(d: BikeParkDetailsRow | null): string {
  if (!d) return 'Nicht konfiguriert'
  const parts = [bikeParkStatusKey(d) === 'closed' ? 'Gesperrt' : 'Offen']
  const hours = (d.opening_hours ?? '').replace(/\s+/g, ' ').trim()
  if (hours) parts.push(hours.length > MAX_HOURS_CHARS ? `${hours.slice(0, MAX_HOURS_CHARS - 1)}…` : hours)
  return parts.join(' · ')
}
