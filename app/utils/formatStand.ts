// Berlin time throughout: riders read "15:00" as local, whatever the device zone.
const TZ = 'Europe/Berlin'
const timeFmt = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
const dayFmt = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' })
const weekdayFmt = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'short' })

/** "Stand 15:30" today, "Stand Mo 15:30" on another day; '' for an unparseable timestamp. */
export function formatStand(iso: string, now: Date = new Date()): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  const sameDay = dayFmt.format(at) === dayFmt.format(now)
  const day = sameDay ? '' : `${weekdayFmt.format(at).replace('.', '')} `
  return `Stand ${day}${timeFmt.format(at)}`
}
