import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

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

    it('is "locked" for a free account and "allowed" from Supporter up', async () => {
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

  describe('billing state', () => {
    const subRow = {
      id: 's1', plan_id: 'plus', provider: 'creem', status: 'active',
      current_period_end: '2026-11-03T00:00:00Z', cancel_at_period_end: false,
      provider_customer_id: 'cus_1', customer_email: 'a@b.de', created_at: '2026-10-01T00:00:00Z',
    }
    const free = { plan_id: 'free', level: 0, discount_percent: 0, early_adopter_free_until: null }

    // Routes by URL, so each of the three parallel requests gets its own body.
    function route(opts: { sub?: unknown[]; elig?: unknown[] } = {}) {
      return vi.fn().mockImplementation((url: string) => {
        if (url.includes('get_my_entitlement')) return ok([free])
        if (url.includes('get_my_checkout_eligibility')) return ok(opts.elig ?? [{ eligible: true, reason: null, eligible_from: null }])
        if (url.includes('/subscriptions?')) return ok(opts.sub ?? [])
        return ok([])
      })
    }

    it('are null when logged out', () => {
      const store = useSubscriptionStore()

      expect(store.subscription).toBeNull()
      expect(store.eligibility).toBeNull()
    })

    it('load() fetches subscription and eligibility alongside the entitlement', async () => {
      userRef.value = { id: 'u1' }
      const fetch = route({ sub: [subRow] })
      vi.stubGlobal('fetch', fetch)

      const store = useSubscriptionStore()
      await store.load()

      expect(store.subscription?.id).toBe('s1')
      expect(store.eligibility).toEqual({ eligible: true, reason: null, eligibleFrom: null })
      const urls = fetch.mock.calls.map((c) => c[0] as string)
      for (const part of ['get_my_entitlement', 'get_my_checkout_eligibility', '/subscriptions?']) {
        expect(urls.some((u) => u.includes(part))).toBe(true)
      }
    })

    it('does not mark loaded until all three arrived', async () => {
      userRef.value = { id: 'u1' }
      let arrive!: (v: unknown) => void
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) =>
        url.includes('get_my_checkout_eligibility') ? new Promise((r) => { arrive = r }) : ok([])))

      const store = useSubscriptionStore()
      await Promise.resolve()
      await new Promise((r) => setTimeout(r))
      expect(store.loaded).toBe(false)

      arrive({ ok: true, status: 200, json: () => Promise.resolve([]) })
      await vi.waitFor(() => expect(store.loaded).toBe(true))
    })

    it('resets to null on a reload after logout', async () => {
      // A reactive user, so auth.isLoggedIn recomputes when it clears.
      const user = ref<{ id: string } | null>({ id: 'u1' })
      vi.stubGlobal('useSupabaseUser', () => user)
      setActivePinia(createPinia())
      vi.stubGlobal('fetch', route({ sub: [subRow] }))
      const store = useSubscriptionStore()
      await vi.waitFor(() => expect(store.subscription).not.toBeNull())

      user.value = null
      await vi.waitFor(() => expect(store.subscription).toBeNull())
      vi.stubGlobal('useSupabaseUser', () => userRef)

      expect(store.subscription).toBeNull()
      expect(store.eligibility).toBeNull()
    })

    describe('canBuy', () => {
      async function withEligibility(eligible: boolean, loggedIn = true) {
        userRef.value = loggedIn ? { id: 'u1' } : null
        vi.stubGlobal('fetch', route({ elig: [{ eligible, reason: eligible ? null : 'already_subscribed', eligible_from: null }] }))
        const store = useSubscriptionStore()
        await store.load()
        return store
      }

      it('is true only for a logged-in, eligible user outside the native app', async () => {
        expect((await withEligibility(true)).canBuy(false)).toBe(true)
        setActivePinia(createPinia())
        expect((await withEligibility(true)).canBuy(true)).toBe(false)
        setActivePinia(createPinia())
        expect((await withEligibility(false)).canBuy(false)).toBe(false)
        setActivePinia(createPinia())
        expect((await withEligibility(false)).canBuy(true)).toBe(false)
        setActivePinia(createPinia())
        expect((await withEligibility(true, false)).canBuy(false)).toBe(false)
      })

      it('is false while eligibility is unknown', () => {
        userRef.value = { id: 'u1' }
        vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
        const store = useSubscriptionStore()

        expect(store.canBuy(false)).toBe(false)
      })
    })

    describe('isCancelScheduled / isPastDue', () => {
      async function withSub(patch: Record<string, unknown>) {
        userRef.value = { id: 'u1' }
        vi.stubGlobal('fetch', route({ sub: [{ ...subRow, ...patch }] }))
        const store = useSubscriptionStore()
        await store.load()
        return store
      }

      it('are false without a subscription', () => {
        const store = useSubscriptionStore()

        expect(store.isCancelScheduled).toBe(false)
        expect(store.isPastDue).toBe(false)
      })

      it('isCancelScheduled follows cancel_at_period_end', async () => {
        expect((await withSub({ cancel_at_period_end: true })).isCancelScheduled).toBe(true)
        setActivePinia(createPinia())
        expect((await withSub({ cancel_at_period_end: false })).isCancelScheduled).toBe(false)
      })

      it('isPastDue is true only for status past_due', async () => {
        expect((await withSub({ status: 'past_due' })).isPastDue).toBe(true)
        setActivePinia(createPinia())
        expect((await withSub({ status: 'active' })).isPastDue).toBe(false)
      })
    })
  })
})
