import { FUNCTIONS, anonHeaders } from './http'

export async function submitFeedback(trailId: string, isUpvote: boolean): Promise<void> {
  const res = await fetch(`${FUNCTIONS}/trail-details-feedback`, {
    method: 'POST',
    headers: anonHeaders(),
    body: JSON.stringify({ trail_id: trailId, up: isUpvote }),
  })
  if (!res.ok) throw new Error(`feedback ${res.status}`)
}
