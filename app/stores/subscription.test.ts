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

  describe('loaded', () => {
    it('is true straight away when logged out — there is nothing to wait for', () => {
      const store = useSubscriptionStore()

      expect(store.loaded).toBe(true)
    })

    it('is false while a logged-in user\'s entitlement is on its way, true once it arrived', async () => {
      userRef.value = { id: 'u1' }
      let arrive!: (v: unknown) => void
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((resolve) => { arrive = resolve })))

      const store = useSubscriptionStore()
      await Promise.resolve()
      expect(store.loaded).toBe(false)

      arrive({ ok: true, status: 200, json: () => Promise.resolve([{ plan_id: 'pro', level: 2, discount_percent: 0, early_adopter_free_until: null }]) })
      await vi.waitFor(() => expect(store.loaded).toBe(true))
      expect(store.entitlement.level).toBe(2)
    })

    it('still ends up loaded — as free — when the request throws, so a page is never stuck waiting', async () => {
      userRef.value = { id: 'u1' }
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

      const store = useSubscriptionStore()
      await store.load()

      expect(store.loaded).toBe(true)
      expect(store.entitlement).toEqual(FREE_ENTITLEMENT)
    })
  })

  describe('accessFor', () => {
    async function loadedAs(level: number, earlyAdopterFreeUntil: string | null = null) {
      userRef.value = { id: 'u1' }
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(ok([
        { plan_id: level >= 2 ? 'pro' : level === 1 ? 'plus' : 'free', level, discount_percent: 0, early_adopter_free_until: earlyAdopterFreeUntil },
      ])))
      const store = useSubscriptionStore()
      await store.load()
      return store
    }

    it('is "locked" for a logged-out visitor, without waiting for anything', () => {
      const store = useSubscriptionStore()

      expect(store.accessFor('trail_condition')).toBe('locked')
    })

    it('is "checking" for a logged-in user whose entitlement has not arrived — so a paying user never sees the locked card flash', () => {
      userRef.value = { id: 'u1' }
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
      const store = useSubscriptionStore()

      expect(store.accessFor('trail_condition')).toBe('checking')
    })

    it('is "locked" for a free account and "allowed" from Plus up', async () => {
      expect((await loadedAs(0)).accessFor('trail_condition')).toBe('locked')
      setActivePinia(createPinia())
      expect((await loadedAs(1)).accessFor('trail_condition')).toBe('allowed')
      setActivePinia(createPinia())
      expect((await loadedAs(2)).accessFor('trail_condition')).toBe('allowed')
    })

    it('is "allowed" for an early adopter holding the Pro grant', async () => {
      const store = await loadedAs(2, '2027-03-23T00:00:00Z')

      expect(store.isEarlyAdopter).toBe(true)
      expect(store.accessFor('trail_condition')).toBe('allowed')
    })
  })

  it('isEarlyAdopter reflects only whether earlyAdopterFreeUntil is set', () => {
    const store = useSubscriptionStore()

    store.entitlement.earlyAdopterFreeUntil = null
    expect(store.isEarlyAdopter).toBe(false)

    store.entitlement.earlyAdopterFreeUntil = '2027-03-23T00:00:00Z'
    expect(store.isEarlyAdopter).toBe(true)
  })
})
