import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { renderToString } from 'vue/server-renderer'

// Same stubbing rationale as stores/subscription.test.ts: no Nuxt runtime here,
// so the auto-imported stores are real globalThis bindings.
const getSession = vi.fn()
// The auth store resolves the role through this RPC and only falls back to a table
// query (`client.from`) if it fails — so it has to answer, as in the store test.
const rpc = vi.fn()
const userRef: { value: { id: string } | null } = { value: null }
vi.stubGlobal('useSupabaseClient', () => ({ auth: { getSession, signInWithPassword: vi.fn() }, rpc }))
vi.stubGlobal('useSupabaseUser', () => userRef)

import { useAuthStore } from '~/stores/auth'
vi.stubGlobal('useAuthStore', useAuthStore)
import { useSubscriptionStore } from '~/stores/subscription'
vi.stubGlobal('useSubscriptionStore', useSubscriptionStore)

import { useFeatureAccess } from './useFeatureAccess'

function entitlementResponse(level: number) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([{ plan_id: level ? 'plus' : 'free', level, discount_percent: 0, early_adopter_free_until: null }]),
  })
}

/** A component that just prints the access state, so the composable is tested the way a page uses it. */
const Probe = defineComponent({
  setup() {
    const access = useFeatureAccess('trail_condition')
    return () => h('span', { 'data-access': access.value })
  },
})

describe('useFeatureAccess', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    userRef.value = null
    rpc.mockReset().mockResolvedValue({ data: 'user' })
    getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'token-123' } } })
  })

  it('says "checking" during server rendering even for an entitled user — the prerendered page must not bake in one visitor\'s answer', async () => {
    userRef.value = { id: 'u1' }
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(entitlementResponse(1)))
    await useSubscriptionStore().load()

    const html = await renderToString(h(Probe))

    expect(html).toContain('data-access="checking"')
  })

  it('says "allowed" once mounted for a Plus user', async () => {
    userRef.value = { id: 'u1' }
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(entitlementResponse(1)))
    await useSubscriptionStore().load()

    const wrapper = mount(Probe)
    await wrapper.vm.$nextTick()

    expect(wrapper.attributes('data-access')).toBe('allowed')
  })

  it('says "locked" once mounted for a logged-out visitor', async () => {
    const wrapper = mount(Probe)
    await wrapper.vm.$nextTick()

    expect(wrapper.attributes('data-access')).toBe('locked')
  })

  it('says "locked" for a free account', async () => {
    userRef.value = { id: 'u1' }
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(entitlementResponse(0)))
    await useSubscriptionStore().load()

    const wrapper = mount(Probe)
    await wrapper.vm.$nextTick()

    expect(wrapper.attributes('data-access')).toBe('locked')
  })

  it('moves from "checking" to "allowed" by itself when the entitlement arrives after mount', async () => {
    userRef.value = { id: 'u1' }
    let arrive!: (v: unknown) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((resolve) => { arrive = resolve })))
    const store = useSubscriptionStore()

    const wrapper = mount(Probe)
    await wrapper.vm.$nextTick()
    expect(wrapper.attributes('data-access')).toBe('checking')

    arrive(await entitlementResponse(1))
    await vi.waitFor(() => expect(store.loaded).toBe(true))
    await wrapper.vm.$nextTick()

    expect(wrapper.attributes('data-access')).toBe('allowed')
  })
})
