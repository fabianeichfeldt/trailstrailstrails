import { FUNCTIONS, anonHeaders } from './http'

function isPwa(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function trackVisit(path: string, referrer: string): void {
  fetch(`${FUNCTIONS}/add-visit`, {
    method: 'POST',
    headers: {
      ...anonHeaders(),
      referrer,
      path,
      pwa: String(isPwa()),
    },
  }).catch(() => {})
}
