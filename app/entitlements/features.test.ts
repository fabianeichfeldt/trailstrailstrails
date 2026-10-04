import { describe, it, expect } from 'vitest'
import { FEATURES, planNameForLevel, minPlanName, SIGNUP_PROMO, isSignupPromoActive } from './features'

describe('signup promo', () => {
  it('is 4 weeks, mirroring grant_free_access() in the live DB', () => {
    expect(SIGNUP_PROMO.weeks).toBe(4)
  })

  it('runs through the end of 30.11.2026 Berlin time and is over from 1.12.', () => {
    expect(isSignupPromoActive(new Date('2026-10-03T12:00:00Z'))).toBe(true)
    expect(isSignupPromoActive(new Date('2026-11-30T22:59:59Z'))).toBe(true) // 23:59:59 CET
    expect(isSignupPromoActive(new Date('2026-11-30T23:00:00Z'))).toBe(false) // 00:00 CET on 1.12.
  })
})

describe('trail_condition', () => {
  it('is a Supporter feature: Supporter (level 1) and everything above it — so Pro and the early-adopter Pro grant — get it', () => {
    // Pinned on purpose: the trail-condition edge function (trailradar-backend,
    // REQUIRED_LEVEL) enforces the same number. Change both together.
    expect(FEATURES.trail_condition.minLevel).toBe(1)
  })

  it('has a German label for the teaser', () => {
    expect(FEATURES.trail_condition.label).toBe('Trail-Zustand')
  })
})

describe('planNameForLevel', () => {
  it('names the seeded plans by level', () => {
    expect(planNameForLevel(1)).toBe('Supporter')
    expect(planNameForLevel(2)).toBe('Pro')
  })

  it('does not invent a plan name for a level it does not know', () => {
    expect(planNameForLevel(7)).toBe('Stufe 7')
  })
})

describe('minPlanName', () => {
  it('names the cheapest plan that unlocks a feature, so the teaser can say what to get', () => {
    expect(minPlanName('trail_condition')).toBe('Supporter')
  })
})
