import { describe, it, expect } from 'vitest'
import { FEATURES, planNameForLevel, minPlanName } from './features'

describe('trail_condition', () => {
  it('is a Plus feature: Plus (level 1) and everything above it — so Pro and the early-adopter Pro grant — get it', () => {
    expect(FEATURES.trail_condition.minLevel).toBe(1)
  })

  it('has a German label for the teaser', () => {
    expect(FEATURES.trail_condition.label).toBe('Trail-Zustand')
  })
})

describe('planNameForLevel', () => {
  it('names the seeded plans by level', () => {
    expect(planNameForLevel(1)).toBe('Plus')
    expect(planNameForLevel(2)).toBe('Pro')
  })

  it('does not invent a plan name for a level it does not know', () => {
    expect(planNameForLevel(7)).toBe('Stufe 7')
  })
})

describe('minPlanName', () => {
  it('names the cheapest plan that unlocks a feature, so the teaser can say what to get', () => {
    expect(minPlanName('trail_condition')).toBe('Plus')
  })
})
