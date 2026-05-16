import type { SupabaseClient } from '@supabase/supabase-js'

export default defineNuxtPlugin({
  enforce: 'post',
  setup() {
    const client = useSupabaseClient() as SupabaseClient
    const session = useSupabaseSession()
    const user = useSupabaseUser()

    // @nuxtjs/supabase's page:start hook calls getClaims() on every navigation.
    // getClaims() has two failure modes that incorrectly wipe user AND session:
    //   1. JWT expired while page:start races the token refresh in progress.
    //   2. Cold start: getClaims() falls back to getUser() (network call) before
    //      the connection is warm.
    //
    // When both are wiped the watch-based approach can't recover. Fix: drive
    // user/session from the Supabase client's own auth events, which are
    // authoritative. TOKEN_REFRESHED fires once the refresh completes and
    // restores state that getClaims() already cleared. Only clear on SIGNED_OUT.
    client.auth.onAuthStateChange((event, s) => {
      if (s) {
        user.value = s.user as any
        session.value = s as any
      } else if (event === 'SIGNED_OUT') {
        user.value = null
        session.value = null
      }
    })

    // Belt-and-suspenders for the getUser() network-failure case (no auth state
    // change fires): if user is wiped but getSession() still holds a valid session,
    // restore immediately.
    watch(user, async (u) => {
      if (u) return
      const { data } = await client.auth.getSession()
      if (data.session?.user) {
        user.value = data.session.user as any
        session.value = data.session as any
      }
    })
  },
})
