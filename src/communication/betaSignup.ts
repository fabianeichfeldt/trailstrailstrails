import { REST, anonHeaders } from './http'

// Temporary Android beta waitlist (see
// docs/superpowers/specs/2026-08-19-android-beta-waitlist-design.md) —
// remove this file, its test, and the beta_signups table together once the
// waitlist is retired.

export async function submitBetaSignup(name: string, email: string): Promise<void> {
  const res = await fetch(`${REST}/beta_signups`, {
    method: 'POST',
    cache: 'no-store',
    headers: anonHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ name, email }),
  })
  if (res.status === 409) throw new Error('DUPLICATE_EMAIL')
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
}
