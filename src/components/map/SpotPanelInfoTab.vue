<template>
  <div class="spot-info-tab-inner">
    <div v-if="loading" class="spot-info-loading">
      <div class="loading-spinner"></div>
      <p>Lade Details …</p>
    </div>
    <p v-else-if="error" class="spot-info-error">⚠️ Details derzeit nicht verfügbar.</p>
    <div v-else ref="contentEl" class="spot-info-content" v-html="detailsHtml"></div>
  </div>
</template>

<script setup lang="ts">
import { createApp, h, type App } from 'vue'
import type { Trail } from '~/types/Trail'
import type { TrailDetails } from '~/types/TrailDetails'
import { getTrailDetails } from '~/communication/trails'
import { renderTrailDetails } from '~/map/detail_popup/detailsPopup'
import { bindPopupEvents, startPhotoCarousel } from '~/map/detail_popup/logic'
import { setupYT2Click } from '~/map/detail_popup/yt'
import { bindPhotoLightbox } from '~/map/lightbox'
import SpotPanelComments from './SpotPanelComments.vue'

// Live island mounted by src/map/spot_panel/spotPanel.ts into #spot-info-tab
// (see the migration spec's "island mechanism" and spotPanel.ts's
// renderInfo()). Replaces the innerHTML-driven loadInfo()/updateLikeButton()/
// setupComments()/loadComments() (Phase 5a of the spot-panel Vue migration —
// the last section still doing raw innerHTML writes). detail_popup/,
// lightbox.ts and confirmDialog.ts (via SpotPanelComments.vue) stay
// unchanged — only their call site moved here, per the migration's hard
// constraint.
//
// Deliberately eager: fetches as soon as a spot is open (mount / currentItem
// change), not lazily gated on the user actually clicking the Info tab (the
// old activateTab()'s `if (tab === 'info' && !infoLoaded) loadInfo()`).
// Matches the pattern already established by Tours/Trails (Phase 3), which
// fetch unconditionally on open regardless of the initial tab. The one
// behavior change: opening straight onto the Parking tab (openParkingLot())
// now also fires the Info-tab fetch (and therefore the like button/comment
// count) in the background instead of waiting for a manual tab switch.
const store = useSpotPanelStore()
const authStore = useAuthStore()
const mapStore = useMapStore()
const supabaseUser = useSupabaseUser()

const loading = ref(true)
const error = ref(false)
const detailsHtml = ref('')
const contentEl = ref<HTMLElement | null>(null)

let commentsApp: App | null = null

// Auth adapter bridging Pinia → the legacy `Auth`-shaped interface that
// detail_popup/logic.ts (bindPopupEvents) and detailsPopup.ts
// (renderTrailDetails) expect — same shape/rationale as useTrailMap.ts's
// authAdapter and SpotPanelComments.vue's authServiceAdapter().
const authAdapter = {
  authService: {
    get loggedIn() { return authStore.isLoggedIn },
    async getUser() {
      return {
        id: supabaseUser.value?.id ?? '',
        email: supabaseUser.value?.email ?? '',
        nickname: authStore.nickname,
        accessToken: await authStore.getToken(),
        avatarUrl: authStore.avatarUrl,
        avatarHTML: '',
        isAdmin: authStore.isAdmin,
        isTrailcrew: authStore.isTrailcrew,
      }
    },
    async signIn(email: string, password: string) { await authStore.signIn(email, password); return {} as any },
    async signUp() { return {} as any },
    async signOut() { await authStore.signOut() },
    async uploadAvatar(file: File) { return authStore.uploadAvatar(file) },
    async updatePassword(oldPw: string, newPw: string) { return authStore.updatePassword(oldPw, newPw) },
    async updateProfile(params: any) { return authStore.updateProfile(params) },
    async resetPassword(email: string) { return authStore.resetPassword(email) },
    async signInWithGoogle() { return authStore.signInWithGoogle() as any },
    async uploadTrailPhoto(file: File, trailId: string) { return authStore.uploadTrailPhoto(file, trailId) },
  },
  async openSignInModal() { mapStore.authModalOpen = true },
  async openReportModal(trailId: string, trailName: string) {
    mapStore.reportModalOpen = true
    mapStore.reportModalTrailId = trailId
    mapStore.reportModalTrailName = trailName
  },
}

async function updateLikeButton(details: TrailDetails) {
  try {
    const user = await authAdapter.authService.getUser()
    store.isLiked = user != null && !!details.likes?.find(l => l.user_id === user.id)
  } catch {
    store.isLiked = false
  }
  store.likeVisible = true
}

async function loadComments(spotId: string) {
  const user = await authAdapter.authService.getUser()
  if (store.currentItem?.id !== spotId) return
  await store.loadComments(spotId, {
    userId: user.id,
    isAdmin: !!user.isAdmin,
    isTrailcrew: !!user.isTrailcrew,
  })
}

/**
 * Mounts (or remounts) the Comments island into the freshly-rendered
 * #spot-comments-section placeholder embedded in detailsHtml — that div is a
 * brand-new DOM node every time detailsHtml changes (initial load or a
 * post-upload refresh), same as the vanilla setupComments()'s doc comment
 * explained, so any previous app instance is already orphaned.
 */
function setupComments(spotId: string, content: HTMLElement) {
  const container = content.querySelector('#spot-comments-section') as HTMLElement | null
  if (!container) return
  commentsApp?.unmount()
  commentsApp = createApp(() => h(SpotPanelComments))
  commentsApp.mount(container)
  if (!store.commentsLoaded) loadComments(spotId)
}

async function renderDetails(item: Trail, details: TrailDetails) {
  detailsHtml.value = renderTrailDetails(item, details, authAdapter as any)
  loading.value = false
  error.value = false
  await nextTick()
  const content = contentEl.value
  if (!content) return
  await bindPopupEvents(content, authAdapter as any, async () => {
    if (store.currentItem?.id !== item.id) return
    const freshDetails = await getTrailDetails(item)
    if (store.currentItem?.id !== item.id) return
    detailsHtml.value = renderTrailDetails(item, freshDetails, authAdapter as any)
    await nextTick()
    const freshContent = contentEl.value
    if (!freshContent) return
    startPhotoCarousel(freshContent)
    bindPhotoLightbox(freshContent)
    setupYT2Click(freshContent)
    setupComments(item.id, freshContent)
  })
  startPhotoCarousel(content)
  bindPhotoLightbox(content)
  setupYT2Click(content)
  setupComments(item.id, content)
}

async function loadInfo(item: Trail) {
  loading.value = true
  error.value = false
  detailsHtml.value = ''
  commentsApp?.unmount()
  commentsApp = null
  try {
    const details = await getTrailDetails(item)
    if (store.currentItem?.id !== item.id) return // spot moved on while the fetch was in flight
    await updateLikeButton(details)
    await renderDetails(item, details)
  } catch (e) {
    console.error('Failed to fetch trail details:', e)
    if (store.currentItem?.id !== item.id) return
    error.value = true
    loading.value = false
  }
}

watch(
  () => store.currentItem?.id,
  (id) => {
    if (!id) {
      loading.value = true
      error.value = false
      detailsHtml.value = ''
      commentsApp?.unmount()
      commentsApp = null
      return
    }
    loadInfo(store.currentItem as Trail)
  },
  { immediate: true },
)

onUnmounted(() => {
  commentsApp?.unmount()
  commentsApp = null
})
</script>
