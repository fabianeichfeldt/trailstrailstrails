export default defineNuxtPlugin({
  enforce: 'post',
  setup() {
    const session = useSupabaseSession()
    const user = useSupabaseUser()

    // The @nuxtjs/supabase plugin has two failure modes that leave user as null
    // even when a valid session is in localStorage:
    //
    // 1. On cold start: getClaims() falls back to getUser() (network call) which
    //    can fail before the connection is warm.
    // 2. page:start hook re-runs getClaims() on every navigation (incl. initial
    //    page load) and blindly sets user = null when getClaims() fails.
    //
    // Fix: watch session → fill user from session.user when user is null.
    // Also watch user → if it gets cleared while session still has a user
    // (only getClaims failure can cause this; real logout clears session first),
    // restore it immediately.

    watch(session, (s) => {
      if (s?.user && !user.value) {
        user.value = s.user as any
      }
    }, { immediate: true })

    watch(user, (u) => {
      if (!u && session.value?.user) {
        user.value = session.value.user as any
      }
    })
  },
})
