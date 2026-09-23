import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Same rationale as auth.test.ts: no Nuxt runtime in vitest, so the handful
// of auto-imports subscription.ts and auth.ts rely on as bare globals are
// stubbed here as real `globalThis` bindings.
const signInWithPassword = vi.fn()
const getSession = vi.fn()
const rpc = vi.fn()

const mockClient = {
  auth: { signInWithPassword, getSession },
  rpc,
}

const userRef: { value: { id: string } | null } = { value: null }

vi.stubGlobal('useSupabaseClient', () => mockClient)
vi.stubGlobal('useSupabaseUser', () => userRef)

import { useAuthStore } from './auth'
vi.stubGlobal('useAuthStore', useAuthStore)

import { useSubscriptionStore } from './subscription'
import { FREE_ENTITLEMENT } from '~/communication/subscriptions'

function ok(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
}

describe('useSubscriptionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    userRef.value = null
    rpc.mockReset().mockResolvedValue({ data: 'user' })
    getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'token-123' } } })
  })

  it('stays at the free entitlement when logged out', () => {
    const store = useSubscriptionStore()
    expect(store.entitlement).toEqual(FREE_ENTITLEMENT)
  })

  it('loads the entitlement via getMyEntitlement when a user is present', async () => {
    userRef.value = { id: 'u1' }
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([
      { plan_id: 'pro', level: 2, discount_percent: 20, early_adopter_free_until: null },
    ])))

    const store = useSubscriptionStore()
    await store.load()

    expect(store.entitlement).toEqual({ planId: 'pro', level: 2, discountPercent: 20, earlyAdopterFreeUntil: null })
  })

  it('hasFeature compares the current level against the feature minLevel', () => {
    const store = useSubscriptionStore()

    store.entitlement.level = 0
    expect(store.hasFeature('offline_gpx_download')).toBe(false)

    store.entitlement.level = 1
    expect(store.hasFeature('offline_gpx_download')).toBe(true)
  })

  it('isEarlyAdopter reflects only whether earlyAdopterFreeUntil is set', () => {
    const store = useSubscriptionStore()

    store.entitlement.earlyAdopterFreeUntil = null
    expect(store.isEarlyAdopter).toBe(false)

    store.entitlement.earlyAdopterFreeUntil = '2027-03-23T00:00:00Z'
    expect(store.isEarlyAdopter).toBe(true)
  })
})
