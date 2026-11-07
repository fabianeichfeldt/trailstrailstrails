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
const from = vi.fn()
const getSession = vi.fn()

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
    getSession,
  },
  rpc,
  from,
}

vi.stubGlobal('useSupabaseClient', () => mockClient)
const userRef = ref<any>(null)
vi.stubGlobal('useSupabaseUser', () => userRef)

const native = { value: false }
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }))

vi.mock('~/communication/photos', () => ({ uploadTrailPhoto: vi.fn(), uploadAvatar: vi.fn(), deletePhoto: vi.fn() }))

const browserClose = vi.fn().mockResolvedValue(undefined)
const browserOpen = vi.fn()
vi.mock('@capacitor/browser', () => ({ Browser: { open: (o: any) => browserOpen(o), close: () => browserClose() } }))

import { useAuthStore } from './auth'
import { deletePhoto } from '~/communication/photos'

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

describe('useAuthStore.deleteTrailPhoto', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    userRef.value = null
    userRef.value = null
    rpc.mockResolvedValue({ data: 'user' })
    vi.mocked(deletePhoto).mockReset().mockResolvedValue(undefined)
  })

  it('throws "Not logged in" when there is no user, without calling deletePhoto', async () => {
    const store = useAuthStore()
    userRef.value = null

    await expect(
      store.deleteTrailPhoto({ id: 1, url: 'https://x/trail-photos/t1/a.webp' })
    ).rejects.toThrow('Not logged in')
    expect(deletePhoto).not.toHaveBeenCalled()
  })

  it('delegates to deletePhoto(photo, client) when logged in', async () => {
    const store = useAuthStore()
    userRef.value = { id: 'u1' } as any

    const photo = { id: 1, url: 'https://x/trail-photos/t1/a.webp' }
    await store.deleteTrailPhoto(photo)

    expect(deletePhoto).toHaveBeenCalledWith(photo, mockClient)
  })
})

const flush = () => new Promise((r) => setTimeout(r, 0))

function fresh() {
  setActivePinia(createPinia())
  userRef.value = null
  native.value = false
  for (const f of [signInWithPassword, signOut, signUp, updateUser, signInWithOAuth, resetPasswordForEmail, getSession, rpc, from, browserOpen]) f.mockReset()
  updateUser.mockResolvedValue({ error: null })
  signInWithPassword.mockResolvedValue({ data: { user: {} }, error: null })
  signUp.mockResolvedValue({ error: null })
  signInWithOAuth.mockResolvedValue({ data: {}, error: null })
  rpc.mockResolvedValue({ data: 'user' })
}

describe('useAuthStore role resolution', () => {
  beforeEach(fresh)

  it('stays "user" and skips the RPC when logged out', async () => {
    const store = useAuthStore()
    await flush()
    expect(rpc).not.toHaveBeenCalled()
    expect(store.dbRole).toBe('user')
    expect(store.isAdmin).toBe(false)
    expect(store.isTrailcrew).toBe(false)
  })

  it('loads the role through get_my_role on login; admin implies trailcrew', async () => {
    rpc.mockResolvedValue({ data: 'admin' })
    const store = useAuthStore()
    userRef.value = { id: 'u1' }
    await flush()
    expect(rpc).toHaveBeenCalledWith('get_my_role')
    expect(store.dbRole).toBe('admin')
    expect(store.isAdmin).toBe(true)
    expect(store.isTrailcrew).toBe(true)
  })

  it('trailcrew is trailcrew but not admin', async () => {
    rpc.mockResolvedValue({ data: 'trailcrew' })
    const store = useAuthStore()
    userRef.value = { id: 'u1' }
    await flush()
    expect(store.isTrailcrew).toBe(true)
    expect(store.isAdmin).toBe(false)
  })

  it('defaults to "user" when the RPC returns null data', async () => {
    rpc.mockResolvedValue({ data: null })
    const store = useAuthStore()
    userRef.value = { id: 'u1' }
    await flush()
    expect(store.dbRole).toBe('user')
  })

  it('falls back to querying user_roles when the RPC throws', async () => {
    rpc.mockRejectedValue(new Error('rpc down'))
    const limit = vi.fn().mockResolvedValue({ data: [{ role: 'trailcrew' }] })
    const select = vi.fn(() => ({ limit }))
    from.mockReturnValue({ select })
    const store = useAuthStore()
    userRef.value = { id: 'u1' }
    await flush()
    expect(from).toHaveBeenCalledWith('user_roles')
    expect(select).toHaveBeenCalledWith('role')
    expect(limit).toHaveBeenCalledWith(1)
    expect(store.dbRole).toBe('trailcrew')
  })

  it('fallback yields "user" when user_roles has no rows', async () => {
    rpc.mockRejectedValue(new Error('rpc down'))
    from.mockReturnValue({ select: () => ({ limit: () => Promise.resolve({ data: [] }) }) })
    const store = useAuthStore()
    userRef.value = { id: 'u1' }
    await flush()
    expect(store.dbRole).toBe('user')
  })

  it('resets the role to "user" on logout', async () => {
    rpc.mockResolvedValue({ data: 'admin' })
    const store = useAuthStore()
    userRef.value = { id: 'u1' }
    await flush()
    userRef.value = null
    await flush()
    expect(store.dbRole).toBe('user')
    expect(store.isLoggedIn).toBe(false)
  })

  it('honours user_metadata.role without waiting for the DB role', () => {
    const store = useAuthStore()
    userRef.value = { id: 'u1', user_metadata: { role: 'admin' } }
    expect(store.isAdmin).toBe(true)
    expect(store.isTrailcrew).toBe(true)
    userRef.value = { id: 'u1', user_metadata: { role: 'trailcrew' } }
    expect(store.isAdmin).toBe(false)
    expect(store.isTrailcrew).toBe(true)
  })
})

describe('useAuthStore identity getters', () => {
  beforeEach(fresh)

  it('isLoggedIn reflects the user', () => {
    const store = useAuthStore()
    expect(store.isLoggedIn).toBe(false)
    userRef.value = { id: 'u1' }
    expect(store.isLoggedIn).toBe(true)
  })

  it('nickname prefers name, then nickname, then email local part, then Anonym', () => {
    const store = useAuthStore()
    expect(store.nickname).toBe('Anonym')
    userRef.value = { id: '1', email: 'max@x.de' }
    expect(store.nickname).toBe('max')
    userRef.value = { id: '1', email: 'max@x.de', user_metadata: { nickname: 'nick' } }
    expect(store.nickname).toBe('nick')
    userRef.value = { id: '1', email: 'max@x.de', user_metadata: { nickname: 'nick', name: 'Name' } }
    expect(store.nickname).toBe('Name')
  })

  it('avatarUrl falls back to empty string', () => {
    const store = useAuthStore()
    expect(store.avatarUrl).toBe('')
    userRef.value = { id: '1', user_metadata: { avatar_url: 'http://a/b.png' } }
    expect(store.avatarUrl).toBe('http://a/b.png')
  })

  it('userId uses id, falls back to the JWT-claims .sub, else empty', () => {
    const store = useAuthStore()
    expect(store.userId).toBe('')
    userRef.value = { id: 'u1', sub: 'other' }
    expect(store.userId).toBe('u1')
    userRef.value = { sub: 'claims-sub' }
    expect(store.userId).toBe('claims-sub')
    userRef.value = {}
    expect(store.userId).toBe('')
  })

  it('getUserId prefers the user, then the session user, else empty', async () => {
    const store = useAuthStore()
    userRef.value = { sub: 's1' }
    expect(await store.getUserId()).toBe('s1')
    expect(getSession).not.toHaveBeenCalled()
    userRef.value = null
    getSession.mockResolvedValue({ data: { session: { user: { id: 'sess' } } } })
    expect(await store.getUserId()).toBe('sess')
    getSession.mockResolvedValue({ data: { session: null } })
    expect(await store.getUserId()).toBe('')
  })

  it('getToken returns the session access token or empty', async () => {
    const store = useAuthStore()
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
    expect(await store.getToken()).toBe('tok')
    getSession.mockResolvedValue({ data: { session: null } })
    expect(await store.getToken()).toBe('')
  })

  it('uploadAvatar / uploadTrailPhoto require login and pass the resolved user id', async () => {
    const photos = await import('~/communication/photos')
    vi.mocked(photos.uploadAvatar).mockReset().mockResolvedValue('avatar-url')
    vi.mocked(photos.uploadTrailPhoto).mockReset().mockResolvedValue('photo-url')
    const store = useAuthStore()
    const file = new File(['x'], 'a.png')
    await expect(store.uploadAvatar(file)).rejects.toThrow('Not logged in')
    await expect(store.uploadTrailPhoto(file, 't1')).rejects.toThrow('Not logged in')
    userRef.value = { sub: 'claims-sub' }
    expect(await store.uploadAvatar(file)).toBe('avatar-url')
    expect(photos.uploadAvatar).toHaveBeenCalledWith(file, 'claims-sub', mockClient)
    expect(await store.uploadTrailPhoto(file, 't1', 'me')).toBe('photo-url')
    expect(photos.uploadTrailPhoto).toHaveBeenCalledWith(file, 't1', mockClient, 'claims-sub', 'me')
  })
})

describe('useAuthStore sign in / up / out / profile', () => {
  beforeEach(fresh)

  it('signIn passes credentials and throws the Supabase error message', async () => {
    const store = useAuthStore()
    await store.signIn('a@b.de', 'pw')
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.de', password: 'pw' })
    signInWithPassword.mockResolvedValue({ data: {}, error: { message: 'bad creds' } })
    await expect(store.signIn('a@b.de', 'x')).rejects.toThrow('bad creds')
  })

  it('signIn migrates a legacy nickname to name once', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { user_metadata: { nickname: 'old', avatarUrl: 'http://av' } } }, error: null })
    const store = useAuthStore()
    await store.signIn('a@b.de', 'pw')
    expect(updateUser).toHaveBeenCalledWith({ data: { name: 'old', avatar_url: 'http://av' } })
  })

  it('signIn migration defaults avatar_url to empty', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { user_metadata: { nickname: 'old' } } }, error: null })
    await useAuthStore().signIn('a@b.de', 'pw')
    expect(updateUser).toHaveBeenCalledWith({ data: { name: 'old', avatar_url: '' } })
  })

  it('signIn does not migrate when name exists or no nickname', async () => {
    const store = useAuthStore()
    signInWithPassword.mockResolvedValue({ data: { user: { user_metadata: { nickname: 'old', name: 'new' } } }, error: null })
    await store.signIn('a@b.de', 'pw')
    signInWithPassword.mockResolvedValue({ data: { user: { user_metadata: {} } }, error: null })
    await store.signIn('a@b.de', 'pw')
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: null })
    await store.signIn('a@b.de', 'pw')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('signOut calls Supabase signOut', async () => {
    await useAuthStore().signOut()
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('signUp creates the account then stores the nickname; errors abort before the nickname', async () => {
    const store = useAuthStore()
    await store.signUp('a@b.de', 'pw', 'Max')
    expect(signUp).toHaveBeenCalledWith({ email: 'a@b.de', password: 'pw' })
    expect(updateUser).toHaveBeenCalledWith({ data: { nickname: 'Max' } })
    updateUser.mockClear()
    signUp.mockResolvedValue({ error: { message: 'taken' } })
    await expect(store.signUp('a@b.de', 'pw', 'Max')).rejects.toThrow('taken')
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('updateProfile and updatePassword send the right payload and surface errors', async () => {
    const store = useAuthStore()
    await store.updateProfile({ name: 'N', avatar_url: 'u' })
    expect(updateUser).toHaveBeenCalledWith({ data: { name: 'N', avatar_url: 'u' } })
    await store.updatePassword('newpw')
    expect(updateUser).toHaveBeenCalledWith({ password: 'newpw' })
    updateUser.mockResolvedValue({ error: { message: 'weak' } })
    await expect(store.updateProfile({ name: 'x' })).rejects.toThrow('weak')
    await expect(store.updatePassword('x')).rejects.toThrow('weak')
  })

  it('signInWithGoogle on web redirects to the current origin', async () => {
    await useAuthStore().signInWithGoogle()
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: window.location.origin } })
    expect(browserOpen).not.toHaveBeenCalled()
  })

  it('signInWithGoogle on native opens the system browser with the custom scheme', async () => {
    native.value = true
    signInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google/x' }, error: null })
    await useAuthStore().signInWithGoogle()
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'org.trailradar.app://auth-callback', skipBrowserRedirect: true },
    })
    expect(browserOpen).toHaveBeenCalledWith({ url: 'https://accounts.google/x' })
  })

  it('signInWithGoogle on native throws on error and skips the browser without a url', async () => {
    native.value = true
    const store = useAuthStore()
    await store.signInWithGoogle()
    expect(browserOpen).not.toHaveBeenCalled()
    signInWithOAuth.mockResolvedValue({ data: null, error: { message: 'oauth fail' } })
    await expect(store.signInWithGoogle()).rejects.toThrow('oauth fail')
  })

  it('resetPassword uses the web reset page or the native scheme', async () => {
    const store = useAuthStore()
    await store.resetPassword('a@b.de')
    expect(resetPasswordForEmail).toHaveBeenCalledWith('a@b.de', { redirectTo: `${window.location.origin}/reset-password` })
    native.value = true
    await store.resetPassword('a@b.de')
    expect(resetPasswordForEmail).toHaveBeenLastCalledWith('a@b.de', { redirectTo: 'org.trailradar.app://auth-callback' })
  })
})

describe('useAuthStore.handleNativeAuthCallback details', () => {
  beforeEach(() => {
    fresh()
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null })
    setSession.mockReset().mockResolvedValue({ error: null })
    browserClose.mockReset().mockResolvedValue(undefined)
  })

  it('reads type from the query before the hash', async () => {
    const type = await useAuthStore().handleNativeAuthCallback('org.trailradar.app://auth-callback?code=c&type=signup#type=recovery')
    expect(type).toBe('signup')
  })

  it('throws when setSession fails', async () => {
    setSession.mockResolvedValue({ error: { message: 'bad tokens' } })
    await expect(
      useAuthStore().handleNativeAuthCallback('org.trailradar.app://auth-callback#access_token=a&refresh_token=r')
    ).rejects.toThrow('bad tokens')
  })

  it('does not set a session when only the refresh token is present', async () => {
    await useAuthStore().handleNativeAuthCallback('org.trailradar.app://auth-callback#refresh_token=r')
    expect(setSession).not.toHaveBeenCalled()
  })
})
