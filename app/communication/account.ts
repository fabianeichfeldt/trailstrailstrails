import { FUNCTIONS, userHeaders } from './http'

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: 'active_subscription' | 'admin' | 'unknown' }

// Expected refusals are values, not throws; a network failure or unreadable body is 'unknown'.
export async function deleteAccount(jwt: string): Promise<DeleteAccountResult> {
  try {
    const res = await fetch(`${FUNCTIONS}/delete-account`, { method: 'POST', headers: userHeaders(jwt) })
    const body = await res.json().catch(() => ({}))
    if (res.status === 200 && body?.ok === true) return { ok: true }
    if (res.status === 409 && body?.error === 'active_subscription') return { ok: false, error: 'active_subscription' }
    if (res.status === 403 && body?.error === 'admin') return { ok: false, error: 'admin' }
    return { ok: false, error: 'unknown' }
  } catch {
    return { ok: false, error: 'unknown' }
  }
}
