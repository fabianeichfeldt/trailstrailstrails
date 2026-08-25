<template>
  <section class="spot-hero">
    <p class="hero-eyebrow">{{ typeLabel }}</p>
    <div class="hero-title-row">
      <h1>{{ trail.name }}</h1>
      <div class="hero-actions">
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
          :class="{ hidden: !trail.approved }"
          aria-label="Teilen"
          @click="handleShare"
        >
          <i class="fas fa-share-alt"></i>
        </button>
      </div>
    </div>
    <div v-if="shareToast" class="spot-share-toast" :class="[shareToast.type, { show: shareToastVisible }]">
      {{ shareToast.message }}
    </div>
    <a
      v-if="trail.url"
      class="spot-panel-org-link"
      :href="trail.url"
      target="_blank"
      rel="noopener noreferrer"
    ><i class="fas fa-external-link-alt"></i> Zur Trailcrew</a>
  </section>
</template>

<script setup lang="ts">
import type { Trail } from '~/types/Trail'
import { likeTrail, dislikeTrail } from '~/communication/trails'
import { share } from '~/communication/share'
import { copyToClipboard } from '~/utils/clipboard'
import { shareTrail } from '~/map/spot_panel/spotPanelShare'
import type { IAuthService } from '~/auth/auth_service'

// Hero for the routed spot-detail page — replaces SpotPanelHeader.vue's
// role inside the deleted panel (title row + org link + like/share
// actions), minus the close button (there's nothing to close, this is a
// real page).
const props = defineProps<{ trail: Trail }>()

const store = useSpotPanelStore()
const authStore = useAuthStore()
const mapStore = useMapStore()

const typeLabel = computed(() => {
  if (props.trail.type === 'bikepark') return 'Bikepark'
  if (props.trail.type === 'dirtpark') return 'Dirtpark / Pumptrack'
  return 'Trail'
})

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
  if (!authStore.isLoggedIn) {
    mapStore.authModalOpen = true
    return
  }
  const authService = authServiceAdapter()
  if (store.isLiked) {
    await dislikeTrail(props.trail.id, authService)
    store.isLiked = false
  } else {
    await likeTrail(props.trail.id, authService)
    store.isLiked = true
  }
}

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
  await shareTrail(props.trail, {
    hasNativeShare: typeof navigator.share === 'function',
    nativeShare: data => navigator.share(data),
    copyToClipboard,
    showToast: (message, type) => showShareToast(message, type),
    reportShare: share,
  })
}
</script>

<style scoped>
.spot-hero {
  padding: 1.8em 0 0.6em;
  position: relative;
}

.hero-eyebrow {
  font-size: 0.72em;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #2a9d5c;
  margin: 0 0 0.4em;
  font-weight: 600;
}

.hero-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6em;
}

.spot-hero h1 {
  font-size: clamp(1.6em, 5vw, 2.4em);
  font-weight: 800;
  color: #1a2035;
  margin: 0;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-top: 0.15em;
}

.spot-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #8a96a8;
  padding: 0;
  line-height: 1;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
}
.spot-action-btn:hover { background: #f0faf5; color: #1a2035; }
.spot-action-btn.hidden { display: none; }

.spot-share-toast {
  position: absolute;
  right: 0;
  top: 3.2em;
  background: #2b6cb0;
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
  z-index: 20;
}
.spot-share-toast.show { opacity: 1; transform: translateY(0); }
.spot-share-toast.error { background: #e53e3e; }

.spot-panel-org-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82em;
  color: #2b6cb0;
  text-decoration: none;
  margin-top: 0.6em;
}
.spot-panel-org-link:hover { text-decoration: underline; }
</style>
