import { REST, userHeaders } from './http'

export interface InvCode {
  code: string
  expires_at: string
  used_by: string | null
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCode(): string {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

export async function listInvitationCodes(spotId: string, token: string): Promise<InvCode[]> {
  const res = await fetch(
    `${REST}/invitation_codes?spot_id=eq.${encodeURIComponent(spotId)}&select=code,expires_at,used_by&order=created_at.desc`,
    { headers: userHeaders(token) },
  )
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

export async function createInvitationCode(spotId: string, createdBy: string, token: string): Promise<string> {
  const code = randomCode()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const res = await fetch(`${REST}/invitation_codes`, {
    method: 'POST',
    headers: { ...userHeaders(token), Prefer: 'return=minimal' },
    body: JSON.stringify({ code, spot_id: spotId, created_by: createdBy, expires_at: expiresAt }),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return code
}
