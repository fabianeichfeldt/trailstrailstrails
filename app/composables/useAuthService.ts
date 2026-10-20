import type { IAuthService } from '~/auth/auth_service'

/**
 * Minimal IAuthService over the shared auth store — the communication/ calls
 * used by the spot-detail page (comments, likes, trailcrew assignment) only
 * ever call getUser(). Reads the store lazily, so one instance stays current
 * across login/logout.
 */
export function useAuthService(): IAuthService {
  const authStore = useAuthStore()
  return {
    get loggedIn() { return authStore.isLoggedIn },
    async getUser() {
      return {
        id: authStore.userId,
        email: '',
        nickname: authStore.nickname,
        accessToken: await authStore.getToken(),
        avatarUrl: authStore.avatarUrl,
        avatarHTML: '',
        isAdmin: authStore.isAdmin,
        isTrailcrew: authStore.isTrailcrew,
      }
    },
  } as IAuthService
}
