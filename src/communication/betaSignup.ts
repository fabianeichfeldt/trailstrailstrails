import { REST, anonHeaders } from './http'

// Temporary Android beta waitlist (see
// docs/superpowers/specs/2026-08-19-android-beta-waitlist-design.md) —
// remove this file, its test, and the beta_signups table together once the
// waitlist is retired.

// PostgREST/Postgres error bodies are JSON with a "message" field (e.g. our
// rate-limit trigger's RAISE EXCEPTION text) — surface that directly instead
// of a raw "400 {...}" string so it can be shown inline to the user.
async function extractErrorMessage(res: Response): Promise<string> {
  const body = await res.text()
  try {
    return (JSON.parse(body) as { message?: string }).message ?? `${res.status} ${body}`
  } catch {
    return `${res.status} ${body}`
  }
}

export async function submitBetaSignup(name: string, email: string): Promise<void> {
  const res = await fetch(`${REST}/beta_signups`, {
    method: 'POST',
    cache: 'no-store',
    headers: anonHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ name, email }),
  })
  if (res.status === 409) throw new Error('DUPLICATE_EMAIL')
  if (!res.ok) throw new Error(await extractErrorMessage(res))
}
