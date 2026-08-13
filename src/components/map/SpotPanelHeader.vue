<template>
  <div class="spot-panel-title-row">
    <div class="spot-panel-title">{{ store.currentItem?.name }}</div>
    <button class="spot-panel-close" aria-label="Schließen" @click="store.close()">✕</button>
  </div>
  <div class="spot-panel-meta-row">
    <a
      class="spot-panel-org-link"
      :class="{ hidden: !store.currentItem?.url }"
      :href="store.currentItem?.url"
      target="_blank"
      rel="noopener noreferrer"
    >
      <i class="fas fa-external-link-alt"></i> Zur Trailcrew
    </a>
    <div class="spot-panel-actions">
      <button
        class="spot-action-btn spot-like-btn"
        :class="{ hidden: !store.likeVisible }"
        :data-liked="store.isLiked ? 'true' : 'false'"
        aria-label="Favorit"
        @click="handleLike"
      >
        <template v-if="store.isLiked">⭐</template>
        <i v-else class="fa-regular fa-star"></i>
      </button>
      <button
        class="spot-action-btn spot-share-btn"
        :class="{ hidden: !store.currentItem?.approved }"
        aria-label="Teilen"
        @click="handleShare"
      >
        <i class="fas fa-share-alt"></i>
      </button>
      <div v-if="shareToast" class="spot-share-toast" :class="[shareToast.type, { show: shareToastVisible }]">
        {{ shareToast.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { likeTrail, dislikeTrail } from '~/communication/trails'
import { share } from '~/communication/share'
import { copyToClipboard } from '~/utils/clipboard'
import { shareTrail } from '~/map/spot_panel/spotPanelShare'
import type { IAuthService } from '~/auth/auth_service'

// Top-level shell mounted island — src/components/map/SpotPanel.vue. As of
// Phase 5b (the vanilla spotPanel.ts class shell was deleted), this
// component owns like/share/close directly rather than taking them as
// bound-instance-method props from that class — there's no more "class
// holding the injected Auth adapter" to delegate to. Same
// useAuthStore()/useMapStore() direct-access pattern SpotPanelComments.vue
// already established in Phase 2 for building an auth adapter locally.
const store = useSpotPanelStore()
const authStore = useAuthStore()
const mapStore = useMapStore()

/** Minimal IAuthService adapter — likeTrail()/dislikeTrail()
 * (communication/trails.ts) only ever call authService.getUser(), same
 * rationale as SpotPanelComments.vue's authServiceAdapter(). */
function authServiceAdapter(): IAuthService {
  return {
    loggedIn: authStore.isLoggedIn,
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

async function handleLike() {
  if (!store.currentItem) return
  if (!authStore.isLoggedIn) {
    mapStore.authModalOpen = true
    return
  }
  const authService = authServiceAdapter()
  if (store.isLiked) {
    await dislikeTrail(store.currentItem.id, authService)
    store.isLiked = false
  } else {
    await likeTrail(store.currentItem.id, authService)
    store.isLiked = true
  }
}

// Anchored under the share button rather than the app-wide bottom-center
// toast — this only fires for the clipboard fallback (Firefox desktop,
// where navigator.share doesn't exist), right next to the button the user
// just pressed, so it's easy to notice. Ref-based local component state
// replacing the vanilla class's showShareToast()'s
// `panel.querySelector('.spot-panel-actions')` DOM manipulation — there's
// no more `this.panel` to query once spotPanel.ts is gone (Phase 5b).
const shareToast = ref<{ message: string; type: string } | null>(null)
const shareToastVisible = ref(false)
let shareToastTimer: ReturnType<typeof setTimeout> | null = null

function showShareToast(message: string, type = 'success') {
  if (shareToastTimer) clearTimeout(shareToastTimer)
  shareToast.value = { message, type }
  shareToastVisible.value = false
  requestAnimationFrame(() => { shareToastVisible.value = true })
  shareToastTimer = setTimeout(() => { shareToastVisible.value = false }, 2200)
}

async function handleShare() {
  if (!store.currentItem) return
  await shareTrail(store.currentItem, {
    hasNativeShare: typeof navigator.share === 'function',
    nativeShare: data => navigator.share(data),
    copyToClipboard,
    showToast: (message, type) => showShareToast(message, type),
    reportShare: share,
  })
}
</script>
