import type { SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { uploadTrailPhoto as uploadTrailPhotoImpl } from '~/communication/photos'

// Google blocks OAuth sign-in from embedded WebViews, so on native we route
// through the system browser instead and catch the redirect via a custom
// URL scheme (registered in AndroidManifest.xml / Info.plist) rather than
// window.location.origin, which inside the app's WebView isn't a URL the
// OS or an email client can navigate back to.
const NATIVE_AUTH_CALLBACK = 'org.trailradar.app://auth-callback'

export const useAuthStore = defineStore('auth', () => {
  const client = useSupabaseClient() as SupabaseClient
  const user = useSupabaseUser()

  const isLoggedIn = computed(() => user.value !== null)

  const nickname = computed(() =>
    user.value?.user_metadata?.name ||
    user.value?.user_metadata?.nickname ||
    user.value?.email?.split('@')[0] ||
    'Anonym'
  )

  const avatarUrl = computed(() => user.value?.user_metadata?.avatar_url ?? '')

  // DB role — loaded via RPC on login (user_metadata.role is not reliably set)
  const dbRole = ref<'admin' | 'trailcrew' | 'user'>('user')

  async function loadDbRole() {
    if (!user.value) { dbRole.value = 'user'; return }
    try {
      const { data } = await client.rpc('get_my_role')
      dbRole.value = data ?? 'user'
    } catch {
      const { data } = await client.from('user_roles').select('role').limit(1)
      dbRole.value = (data as any)?.[0]?.role ?? 'user'
    }
  }

  watch(user, loadDbRole, { immediate: true })

  const isAdmin = computed(() =>
    user.value?.user_metadata?.role === 'admin' || dbRole.value === 'admin'
  )

  const isTrailcrew = computed(() =>
    user.value?.user_metadata?.role === 'trailcrew' ||
    user.value?.user_metadata?.role === 'admin' ||
    dbRole.value === 'trailcrew' ||
    dbRole.value === 'admin'
  )

  async function signIn(email: string, password: string) {
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    // Migrate legacy nickname field to name on first sign-in
    const meta = data.user?.user_metadata
    if (meta?.nickname && !meta?.name) {
      await client.auth.updateUser({
        data: { name: meta.nickname, avatar_url: meta.avatarUrl ?? '' },
      })
    }
  }

  async function signOut() {
    await client.auth.signOut()
  }

  async function signUp(email: string, password: string, nicknameVal: string) {
    const { error } = await client.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
    await client.auth.updateUser({ data: { nickname: nicknameVal } })
  }

  async function signInWithGoogle() {
    if (Capacitor.isNativePlatform()) {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: NATIVE_AUTH_CALLBACK, skipBrowserRedirect: true },
      })
      if (error) throw new Error(error.message)
      if (data?.url) await Browser.open({ url: data.url })
      return
    }
    await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function resetPassword(email: string) {
    const redirectTo = Capacitor.isNativePlatform()
      ? NATIVE_AUTH_CALLBACK
      : `${window.location.origin}/reset-password`
    await client.auth.resetPasswordForEmail(email, { redirectTo })
  }

  // Handles the redirect Google OAuth / password-recovery emails land on when
  // opened natively (see NATIVE_AUTH_CALLBACK). supabase-js's own URL session
  // detection only runs against window.location, which never navigates for a
  // deep link — the tokens have to be pulled from the callback URL by hand.
  // Returns the auth event `type` (e.g. 'recovery') so the caller can route.
  async function handleNativeAuthCallback(url: string): Promise<string | null> {
    const parsed = new URL(url)
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''))
    const code = parsed.searchParams.get('code')
    const type = parsed.searchParams.get('type') ?? hashParams.get('type')

    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code)
      if (error) throw new Error(error.message)
    } else {
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      if (access_token && refresh_token) {
        const { error } = await client.auth.setSession({ access_token, refresh_token })
        if (error) throw new Error(error.message)
      }
    }

    await Browser.close().catch(() => {})
    return type
  }

  async function updateProfile(params: { avatar_url?: string; name?: string }) {
    const { error } = await client.auth.updateUser({ data: params })
    if (error) throw new Error(error.message)
  }

  async function updatePassword(newPassword: string) {
    const { error } = await client.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message)
  }

  async function uploadAvatar(file: File): Promise<string> {
    if (!user.value) throw new Error('Not logged in')
    const filePath = `${user.value.id}/avatar.webp`
    const { error } = await client.storage
      .from('avatars')
      .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type })
    if (error) throw new Error('Avatar upload failed')
    const { data } = client.storage.from('avatars').getPublicUrl(filePath)
    return data.publicUrl
  }

  async function uploadTrailPhoto(file: File, trailId: string): Promise<string> {
    if (!user.value) throw new Error('Not logged in')
    return uploadTrailPhotoImpl(file, trailId, client, user.value.id)
  }

  const userId = computed(() => user.value?.id ?? '')

  async function getToken(): Promise<string> {
    const { data: { session } } = await client.auth.getSession()
    return session?.access_token ?? ''
  }

  async function getUserId(): Promise<string> {
    if (user.value?.id) return user.value.id
    const { data: { session } } = await client.auth.getSession()
    return session?.user?.id ?? ''
  }

  return {
    user,
    isLoggedIn,
    nickname,
    avatarUrl,
    dbRole,
    isAdmin,
    isTrailcrew,
    userId,
    signIn,
    signOut,
    signUp,
    signInWithGoogle,
    resetPassword,
    handleNativeAuthCallback,
    updateProfile,
    updatePassword,
    uploadAvatar,
    uploadTrailPhoto,
    getToken,
    getUserId,
  }
})
