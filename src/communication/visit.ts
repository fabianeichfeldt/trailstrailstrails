import { FUNCTIONS, anonHeaders } from './http'

export function trackVisit(path: string, referrer: string): void {
  fetch(`${FUNCTIONS}/add-visit`, {
    method: 'POST',
    headers: {
      ...anonHeaders(),
      referrer,
      path,
    },
  }).catch(() => {})
}
