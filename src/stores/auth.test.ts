import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// auth.ts pulls in useSupabaseClient/useSupabaseUser, which only exist
// inside a live Nuxt app — stubbed as globals the same way Nuxt's compiler
// would auto-import them (see vitest.setup.ts for the ref/computed/etc.
// stubs this relies on).
const signInWithPassword = vi.fn()
const signOut = vi.fn()
const signUp = vi.fn()
const updateUser = vi.fn()
const signInWithOAuth = vi.fn()
const resetPasswordForEmail = vi.fn()
const exchangeCodeForSession = vi.fn()
const setSession = vi.fn()
const rpc = vi.fn()

const mockClient = {
  auth: {
    signInWithPassword,
    signOut,
    signUp,
    updateUser,
    signInWithOAuth,
    resetPasswordForEmail,
    exchangeCodeForSession,
    setSession,
  },
  rpc,
}

vi.stubGlobal('useSupabaseClient', () => mockClient)
vi.stubGlobal('useSupabaseUser', () => ({ value: null }))

vi.mock('~/communication/photos', () => ({ uploadTrailPhoto: vi.fn() }))

const browserClose = vi.fn().mockResolvedValue(undefined)
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn(), close: () => browserClose() } }))

import { useAuthStore } from './auth'

describe('useAuthStore.handleNativeAuthCallback', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null })
    setSession.mockReset().mockResolvedValue({ error: null })
    browserClose.mockReset().mockResolvedValue(undefined)
    rpc.mockResolvedValue({ data: 'user' })
  })

  it('exchanges an auth code for a session when the callback carries ?code=', async () => {
    const store = useAuthStore()

    const type = await store.handleNativeAuthCallback(
      'org.trailradar.app://auth-callback?code=abc123&type=signup'
    )

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123')
    expect(setSession).not.toHaveBeenCalled()
    expect(type).toBe('signup')
  })

  it('falls back to the hash-fragment access/refresh tokens when there is no ?code=', async () => {
    const store = useAuthStore()

    const type = await store.handleNativeAuthCallback(
      'org.trailradar.app://auth-callback#access_token=tok-a&refresh_token=tok-r&type=recovery'
    )

    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(setSession).toHaveBeenCalledWith({ access_token: 'tok-a', refresh_token: 'tok-r' })
    expect(type).toBe('recovery')
  })

  it('prefers ?code= over hash tokens when both are somehow present', async () => {
    const store = useAuthStore()

    await store.handleNativeAuthCallback(
      'org.trailradar.app://auth-callback?code=abc123#access_token=tok-a&refresh_token=tok-r'
    )

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123')
    expect(setSession).not.toHaveBeenCalled()
  })

  it('does nothing auth-wise when neither a code nor complete hash tokens are present', async () => {
    const store = useAuthStore()

    const type = await store.handleNativeAuthCallback('org.trailradar.app://auth-callback#type=signup')

    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(setSession).not.toHaveBeenCalled()
    expect(type).toBe('signup')
  })

  it('does not call setSession when only one of the two hash tokens is present', async () => {
    const store = useAuthStore()

    await store.handleNativeAuthCallback('org.trailradar.app://auth-callback#access_token=tok-a')

    expect(setSession).not.toHaveBeenCalled()
  })

  it('returns null when the callback URL carries no type param at all', async () => {
    const store = useAuthStore()

    const type = await store.handleNativeAuthCallback('org.trailradar.app://auth-callback?code=abc123')

    expect(type).toBeNull()
  })

  it('closes the in-app browser tab after handling the callback', async () => {
    const store = useAuthStore()

    await store.handleNativeAuthCallback('org.trailradar.app://auth-callback?code=abc123')

    expect(browserClose).toHaveBeenCalled()
  })

  it('still closes the browser tab even if Browser.close() rejects', async () => {
    browserClose.mockRejectedValue(new Error('no browser open'))
    const store = useAuthStore()

    await expect(
      store.handleNativeAuthCallback('org.trailradar.app://auth-callback?code=abc123')
    ).resolves.not.toThrow()
  })

  it('throws when exchanging the code for a session fails', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'invalid code' } })
    const store = useAuthStore()

    await expect(
      store.handleNativeAuthCallback('org.trailradar.app://auth-callback?code=bad')
    ).rejects.toThrow('invalid code')
  })
})
