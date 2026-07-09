import { FUNCTIONS, anonHeaders } from './http'

export async function submitReport(
  trailId: string,
  trailName: string,
  message: string,
  userId?: string,
): Promise<void> {
  const res = await fetch(`${FUNCTIONS}/report`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({
      trail_id: trailId,
      trail_name: trailName,
      message,
      ...(userId ? { user_id: userId } : {}),
    }),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
}
