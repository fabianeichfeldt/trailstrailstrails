import { anon } from '../anon'
import { SPOT_TYPES } from '../types/SpotTypes'
import type { anyTrailType } from '../types/Trail'

const BASE = import.meta.env.VITE_SUPABASE_URL as string

export interface AddSpotPayload {
  type: anyTrailType
  name: string
  latitude: number
  longitude: number
  url?: string
  instagram?: string
  creator?: string
  creator_id?: string
  pumptrack?: boolean
  dirtpark?: boolean
}

export async function submitSpot(payload: AddSpotPayload, jwt: string): Promise<void> {
  if (!payload.name.trim()) throw new Error('Name ist erforderlich')
  const { type, ...body } = payload
  const res = await fetch(`${BASE}/functions/v1/${SPOT_TYPES[type].addEndpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anon}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
}
