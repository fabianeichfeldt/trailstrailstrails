import { REST, userHeaders } from './http'

export interface Entitlement {
  planId: string          // 'free' when no row comes back
  level: number
  discountPercent: number
  earlyAdopterFreeUntil: string | null
}

export const FREE_ENTITLEMENT: Entitlement = { planId: 'free', level: 0, discountPercent: 0, earlyAdopterFreeUntil: null }

export async function getMyEntitlement(jwt: string): Promise<Entitlement> {
  const res = await fetch(`${REST}/rpc/get_my_entitlement`, {
    method: 'POST', headers: userHeaders(jwt), body: '{}',
  })
  if (!res.ok) return FREE_ENTITLEMENT

  const rows = await res.json()
  const row = rows[0]
  if (!row) return FREE_ENTITLEMENT

  return {
    planId: row.plan_id,
    level: row.level,
    discountPercent: row.discount_percent,
    earlyAdopterFreeUntil: row.early_adopter_free_until,
  }
}
