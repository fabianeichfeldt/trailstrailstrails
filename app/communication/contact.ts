import { FUNCTIONS, anonHeaders } from './http'

export interface ContactMessage {
  name: string
  email: string
  message: string
  /** Honeypot — always empty for people. */
  website: string
}

export type ContactField = 'name' | 'email' | 'message'

export type ContactResult =
  | { ok: true }
  | { ok: false; error: 'invalid'; field: ContactField }
  | { ok: false; error: 'unknown' }

export async function sendContactMessage(msg: ContactMessage): Promise<ContactResult> {
  try {
    const res = await fetch(`${FUNCTIONS}/contact`, {
      method: 'POST',
      headers: anonHeaders(),
      body: JSON.stringify(msg),
    })
    if (res.ok) return { ok: true }
    if (res.status === 400) {
      const body = await res.json().catch(() => null) as { field?: ContactField } | null
      if (body?.field) return { ok: false, error: 'invalid', field: body.field }
    }
  } catch {
    // Network failure: same answer as a server error, the page offers the e-mail address instead.
  }
  return { ok: false, error: 'unknown' }
}
