import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import { useAuthStore } from '~/stores/auth'

// Regression test for a real production bug: posting a spot comment failed
// with "invalid input syntax for type uuid: \"\"" on the first attempt after
// landing on a page.
//
// Root cause: @nuxtjs/supabase's own plugin re-populates useSupabaseUser()
// on every page:start navigation from client.auth.getClaims() (see
// node_modules/@nuxtjs/supabase/dist/runtime/plugins/supabase.client.js),
// which overwrites the ref with the *decoded JWT claims* object — keyed by
// "sub", not "id" — instead of a full Supabase User. app/plugins/
// auth.client.ts's onAuthStateChange listener eventually corrects this back
// to a real User, but there's a window (e.g. right after navigating to a
// trail-detail page) where useSupabaseUser().value has no "id" field at all.
//
// This test deliberately does NOT assert anything about how the user id
// gets resolved internally (that's an implementation detail of
// stores/auth.ts). It only asserts the thing that actually matters: a
// logged-in user clicking "Senden" on the very first try, while
// useSupabaseUser() is in that claims-only shape, ends up with their comment
// actually posted. It exercises the real auth store and the real
// communication/comments.ts HTTP layer, mocking only the network boundary
// (global fetch) and the Supabase client — not the code under test.
vi.stubGlobal('useSupabaseClient', () => ({
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok-abc' } } }),
  },
  rpc: vi.fn().mockResolvedValue({ data: 'user' }),
}))

// The exact shape client.auth.getClaims() hands back on a page:start
// navigation: claims, not a full Supabase User — no "id" field.
vi.stubGlobal('useSupabaseUser', () => ({
  value: { sub: 'user-456', email: 'rider@example.com', user_metadata: {} },
}))

vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)
vi.stubGlobal('useAuthStore', useAuthStore)
vi.stubGlobal('useMapStore', () => ({ authModalOpen: false }))

vi.mock('~/map/confirmDialog', () => ({ confirmDialog: vi.fn() }))
vi.mock('~/utils/toast', () => ({ showToast: vi.fn() }))

import SpotPanelComments from './SpotPanelComments.vue'

describe('SpotPanelComments — posting a comment while the auth user is in the post-navigation claims shape', () => {
  let wrapper: VueWrapper<any>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ([{
        id: 5, spot_id: 's1', user_id: 'user-456',
        comment_text: 'Endlich geflowt!', created_at: '2026-09-17T00:00:00Z',
      }]),
      text: async () => '',
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('actually posts the comment on the first try, without an invalid-uuid error', async () => {
    const store = useSpotPanelStore()
    store.currentItem = { id: 's1', name: 'Spot', type: 'trail', latitude: 1, longitude: 1, approved: true } as any
    store.commentsExpanded = true

    wrapper = mount(SpotPanelComments)

    await wrapper.get('.comments-input').setValue('Endlich geflowt!')
    await wrapper.get('.comments-post-btn').trigger('click')
    await flushPromises()

    // No error surfaced to the user, and the comment shows up in the list —
    // this is the user-visible symptom that was broken.
    expect(wrapper.find('.comments-error').text()).toBe('')
    expect(store.comments.map(c => c.comment_text)).toContain('Endlich geflowt!')
    expect((wrapper.get('.comments-input').element as HTMLTextAreaElement).value).toBe('')

    // Whatever id the app resolved, it must have actually been sent — an
    // empty user_id is exactly what made Postgres reject the request before
    // the fix.
    const postCall = fetchMock.mock.calls.find(([, opts]) => opts?.method === 'POST')
    expect(postCall).toBeTruthy()
    const body = JSON.parse(postCall![1].body)
    expect(body.user_id).toBeTruthy()
  })
})
