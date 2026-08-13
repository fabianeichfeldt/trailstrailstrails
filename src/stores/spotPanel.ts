import type { Trail } from '~/types/Trail'
import { fetchMultipleSpotParking, type SpotParkingLot } from '~/communication/trails'
import {
  getComments,
  getOlderComments,
  postComment as postCommentApi,
  deleteComment as deleteCommentApi,
  COMMENTS_PAGE_SIZE,
} from '~/communication/comments'
import type { Comment } from '~/types/Comment'
import type { IAuthService } from '~/auth/auth_service'

// Comment counts at or below this stay expanded by default — ported as-is
// from spotPanel.ts's AUTO_EXPAND_MAX_COMMENTS (see loadComments() below).
const AUTO_EXPAND_MAX_COMMENTS = 3

/**
 * Minimal identity snapshot loadComments() needs to compute
 * commentsCurrentUserId/commentsCanModerate. Deliberately not a full
 * IAuthService: the store must stay testable by mocking only
 * communication/comments.ts (see spotPanel.test.ts) rather than the whole
 * auth store → Supabase client chain. Callers derive this from whichever
 * auth source they already have (spotPanel.ts's injected Auth adapter
 * during the coexistence period; SpotPanelComments.vue's useAuthStore()
 * once mounted as the live island).
 */
export interface CommentsAuthInfo {
  userId: string
  isAdmin: boolean
  isTrailcrew: boolean
}

// Phase 1 of the spotPanel.ts → Vue/Pinia migration (see
// docs/superpowers/specs/2026-08-13-spot-panel-vue-migration-design.md)
// added the Parking slice; Phase 2 adds Comments below. Tabs/tours/trails/
// elevation are added in later phases, not stubbed out ahead of time.
export const useSpotPanelStore = defineStore('spotPanel', () => {
  const currentItem = ref<Trail | null>(null)
  const isOpen = ref(false)

  const parkingLots = ref<SpotParkingLot[]>([])
  const highlightedParkingLotId = ref<string | null>(null)
  const parkingTabForceVisible = ref(false)

  /**
   * Direct port of the vanilla class's private loadParking()/renderParking()
   * pair — same call into fetchMultipleSpotParking, same guard against a
   * fetch resolving after the panel has already moved on to a different
   * spot (or closed).
   */
  async function loadParking(spotId: string) {
    try {
      const byId = await fetchMultipleSpotParking([spotId])
      if (currentItem.value?.id !== spotId) return
      parkingLots.value = byId.get(spotId) ?? []
    } catch (err) {
      console.warn('Failed to fetch spot parking data:', err)
    }
  }

  // ── Comments ─────────────────────────────────────────────────────────────
  // Direct port of spotPanel.ts's private comments state + loadComments()/
  // loadMoreComments()/handlePostComment()/handleDeleteComment() (Phase 2 of
  // the migration spec). postComment()/deleteComment() take an IAuthService,
  // exactly like communication/comments.ts's postComment()/deleteComment()
  // already require — the store does not own an auth source itself, callers
  // pass one in (see CommentsAuthInfo above).
  const comments = ref<Comment[]>([])
  const commentsExpanded = ref(false)
  const commentsHasMore = ref(false)
  const commentsLoaded = ref(false)
  const commentsCurrentUserId = ref('')
  const commentsCanModerate = ref(false)

  async function loadComments(spotId: string, authInfo: CommentsAuthInfo) {
    try {
      const result = await getComments(spotId)
      if (currentItem.value?.id !== spotId) return
      comments.value = result
      commentsHasMore.value = result.length === COMMENTS_PAGE_SIZE
      // A handful of comments are worth showing right away rather than
      // hiding behind an extra click; once there are enough to feel like a
      // "section" rather than a couple of remarks, default to collapsed.
      commentsExpanded.value = commentsExpanded.value || result.length <= AUTO_EXPAND_MAX_COMMENTS
      commentsCurrentUserId.value = authInfo.userId
      commentsCanModerate.value = authInfo.isAdmin || authInfo.isTrailcrew
      commentsLoaded.value = true
    } catch (err) {
      console.warn('Failed to fetch spot comments:', err)
    }
  }

  async function loadMoreComments() {
    if (!currentItem.value || !comments.value.length) return
    const spotId = currentItem.value.id
    const oldest = comments.value[comments.value.length - 1].created_at
    try {
      const older = await getOlderComments(spotId, oldest)
      if (currentItem.value?.id !== spotId) return
      comments.value = [...comments.value, ...older]
      commentsHasMore.value = older.length === COMMENTS_PAGE_SIZE
    } catch (err) {
      console.warn('Failed to fetch older comments:', err)
    }
  }

  async function postComment(text: string, authService: IAuthService): Promise<Comment> {
    if (!currentItem.value) throw new Error('No spot open')
    const comment = await postCommentApi(currentItem.value.id, text, authService)
    comments.value = [comment, ...comments.value]
    return comment
  }

  async function deleteComment(id: number, authService: IAuthService): Promise<void> {
    await deleteCommentApi(id, authService)
    comments.value = comments.value.filter(c => c.id !== id)
  }

  function toggleCommentsExpanded() {
    commentsExpanded.value = !commentsExpanded.value
  }

  return {
    currentItem,
    isOpen,
    parkingLots,
    highlightedParkingLotId,
    parkingTabForceVisible,
    loadParking,
    comments,
    commentsExpanded,
    commentsHasMore,
    commentsLoaded,
    commentsCurrentUserId,
    commentsCanModerate,
    loadComments,
    loadMoreComments,
    postComment,
    deleteComment,
    toggleCommentsExpanded,
  }
})
