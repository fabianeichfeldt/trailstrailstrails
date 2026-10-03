export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired'

export interface Subscription {
  id: string
  planId: string
  provider: string
  status: SubscriptionStatus
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  hasCustomer: boolean      // a provider_customer_id exists, so the portal can open
  customerEmail: string | null
  createdAt: string
}

export type EligibilityReason = 'already_subscribed' | 'grant_active' | 'unknown'

export interface CheckoutEligibility {
  eligible: boolean
  reason: EligibilityReason | null
  eligibleFrom: string | null
}

export interface SupporterPrices {
  monthlyCents: number
  yearlyCents: number
  currency: string
}
