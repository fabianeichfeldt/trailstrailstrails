import { REST, anonHeaders } from './http'

export interface SupporterPrices {
  monthlyCents: number
  yearlyCents: number
  currency: string
}

/** Gross prices of the Supporter plan, straight from subscription_plans (anon read). Null on any failure. */
export async function getSupporterPrices(): Promise<SupporterPrices | null> {
  try {
    const res = await fetch(
      `${REST}/subscription_plans?id=eq.supporter&select=price_monthly_cents,price_yearly_cents,currency`,
      { headers: anonHeaders() },
    )
    if (!res.ok) return null
    const rows = await res.json()
    const row = Array.isArray(rows) ? rows[0] : undefined
    if (!row) return null
    return { monthlyCents: row.price_monthly_cents, yearlyCents: row.price_yearly_cents, currency: row.currency }
  } catch {
    return null
  }
}
