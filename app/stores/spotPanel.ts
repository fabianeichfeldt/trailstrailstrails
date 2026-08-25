import type { Trail } from '~/types/Trail'
import { fetchMultipleSpotParking, getSpotGpxData, type SpotParkingLot } from '~/communication/trails'
import {
  getComments,
  getOlderComments,
  postComment as postCommentApi,
  deleteComment as deleteCommentApi,
  COMMENTS_PAGE_SIZE,
} from '~/communication/comments'
import type { Comment } from '~/types/Comment'
import type { IAuthService } from '~/auth/auth_service'
import type { SpotMtbData } from '~/types/MtbTypes'

const AUTO_EXPAND_MAX_COMMENTS = 3

/**
 * Deliberately not a full IAuthService: keeps the store testable by mocking
 * only communication/comments.ts, not the whole auth store → Supabase
 * client chain. Callers derive this from whichever auth source they have.
 */
export interface CommentsAuthInfo {
  userId: string
  isAdmin: boolean
  isTrailcrew: boolean
}

export const useSpotPanelStore = defineStore('spotPanel', () => {
  const currentItem = ref<Trail | null>(null)

  const parkingLots = ref<SpotParkingLot[]>([])

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
  // The store doesn't own an auth source itself — postComment()/
  // deleteComment() take an IAuthService, loadComments() takes
  // CommentsAuthInfo; callers pass one in.
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

  // `data` is the spot's tours+trails list (GPX-derived). `selectedItemId`/
  // `selectedItemKind` is which row is selected — drives which section
  // (Touren/Trails) renders <SpotPanelElevation> inline on the spot-detail
  // page (app/pages/trails/[slug].vue).
  const data = ref<SpotMtbData | null>(null)
  const selectedItemId = ref<string | null>(null)
  const selectedItemKind = ref<'tour' | 'trail' | null>(null)

  // No guard against the panel moving to a different spot mid-fetch — a
  // stale response just overwrites `data` for whatever spot is current when
  // it resolves, same risk as an unguarded fetch anywhere else in this file.
  async function loadSpotData(spotId: string) {
    try {
      data.value = await getSpotGpxData(spotId)
    } catch (err) {
      console.warn('Failed to fetch spot GPX data:', err)
    }
  }

  function selectItem(id: string, kind: 'tour' | 'trail') {
    selectedItemId.value = id
    selectedItemKind.value = kind
  }

  // Closes the elevation panel — its visibility on the spot-detail page
  // derives reactively from selectedItemId/selectedItemKind being non-null
  // (see the Touren/Trails sections in app/pages/trails/[slug].vue).
  function clearSelection() {
    selectedItemId.value = null
    selectedItemKind.value = null
  }

  // isLiked/likeVisible back the hero's like button (SpotDetailHero.vue).
  // Populated by SpotDetailInfo.vue's live-details refresh, not
  // independently — the like button stays hidden until that resolves.
  const isLiked = ref(false)
  const likeVisible = ref(false)

  /**
   * Loads `item` for the routed spot-detail page
   * (app/pages/trails/[slug].vue) — every section on that page is always
   * present in its long scroll, just populated once the per-spot fetches
   * this kicks off resolve. loadSpotData() only applies to trail-type
   * spots (bikeparks/dirtparks have no GPX tours/trails); loadParking()
   * runs for every spot type.
   */
  function load(item: Trail) {
    currentItem.value = item
    parkingLots.value = []
    comments.value = []
    commentsExpanded.value = false
    commentsHasMore.value = false
    commentsLoaded.value = false
    isLiked.value = false
    likeVisible.value = false
    data.value = null
    clearSelection()
    if (item.type === 'trail') {
      loadSpotData(item.id)
    }
    loadParking(item.id)
  }

  return {
    currentItem,
    parkingLots,
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
    data,
    selectedItemId,
    selectedItemKind,
    loadSpotData,
    selectItem,
    clearSelection,
    isLiked,
    likeVisible,
    load,
  }
})
