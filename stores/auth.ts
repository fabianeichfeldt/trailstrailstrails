import type { SupabaseClient } from '@supabase/supabase-js'
import { uploadTrailPhoto as uploadTrailPhotoImpl } from '~/src/communication/photos'

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
    await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function resetPassword(email: string) {
    await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
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
    const filePath = `${user.value.sub}/avatar.webp`
    const { error } = await client.storage
      .from('avatars')
      .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type })
    if (error) throw new Error('Avatar upload failed')
    const { data } = client.storage.from('avatars').getPublicUrl(filePath)
    return data.publicUrl
  }

  async function uploadTrailPhoto(file: File, trailId: string): Promise<string> {
    if (!user.value) throw new Error('Not logged in')
    return uploadTrailPhotoImpl(file, trailId, client, user.value.sub)
  }

  return {
    user,
    isLoggedIn,
    nickname,
    avatarUrl,
    dbRole,
    isAdmin,
    isTrailcrew,
    signIn,
    signOut,
    signUp,
    signInWithGoogle,
    resetPassword,
    updateProfile,
    updatePassword,
    uploadAvatar,
    uploadTrailPhoto,
  }
})
