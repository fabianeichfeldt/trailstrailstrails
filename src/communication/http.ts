import { anon } from '../anon'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const REST      = `${SUPABASE_URL}/rest/v1`
export const FUNCTIONS = `${SUPABASE_URL}/functions/v1`

export function anonHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${anon}`,
    'apikey':        anon,
    ...extra,
  }
}

export function userHeaders(token: string, extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey':        anon,
    ...extra,
  }
}

export async function fetchJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}
