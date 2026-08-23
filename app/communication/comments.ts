import { REST, anonHeaders, userHeaders } from './http'
import type { IAuthService } from '../auth/auth_service'
import { Comment } from '../types/Comment'

export const COMMENTS_PAGE_SIZE = 20
const PAGE_SIZE = COMMENTS_PAGE_SIZE
const SELECT = '*,profiles(display_name,avatar_url)'

// PostgREST/Postgres error bodies are JSON with a "message" field (e.g. our
// rate-limit trigger's RAISE EXCEPTION text) — surface that directly instead
// of a raw "429 {...}" string so it can be shown inline to the user.
async function extractErrorMessage(res: Response): Promise<string> {
  const body = await res.text()
  try {
    return (JSON.parse(body) as { message?: string }).message ?? body
  } catch {
    return body
  }
}

export async function getComments(spotId: string): Promise<Comment[]> {
  const res = await fetch(
    `${REST}/spot_comments?select=${SELECT}&spot_id=eq.${spotId}&order=created_at.desc&limit=${PAGE_SIZE}`,
    { method: 'GET', cache: 'no-store', headers: anonHeaders() },
  )
  if (!res.ok) return []
  return res.json()
}

export async function getOlderComments(spotId: string, beforeCreatedAt: string): Promise<Comment[]> {
  const res = await fetch(
    `${REST}/spot_comments?select=${SELECT}&spot_id=eq.${spotId}&created_at=lt.${encodeURIComponent(beforeCreatedAt)}&order=created_at.desc&limit=${PAGE_SIZE}`,
    { method: 'GET', cache: 'no-store', headers: anonHeaders() },
  )
  if (!res.ok) return []
  return res.json()
}

export async function postComment(spotId: string, text: string, authService: IAuthService): Promise<Comment> {
  const user = await authService.getUser()
  const res = await fetch(`${REST}/spot_comments`, {
    method: 'POST',
    cache: 'no-store',
    headers: userHeaders(user.accessToken, { Prefer: 'return=representation' }),
    body: JSON.stringify({ spot_id: spotId, user_id: user.id, comment_text: text }),
  })
  if (!res.ok) throw new Error(await extractErrorMessage(res))
  const [row] = await res.json() as Comment[]
  return { ...row, profiles: { display_name: user.nickname, avatar_url: user.avatarUrl ?? '' } }
}

export async function deleteComment(commentId: number, authService: IAuthService): Promise<void> {
  const user = await authService.getUser()
  const res = await fetch(`${REST}/spot_comments?id=eq.${commentId}`, {
    method: 'DELETE',
    cache: 'no-store',
    headers: userHeaders(user.accessToken),
  })
  if (!res.ok) throw new Error(await extractErrorMessage(res))
}
