<template>
  <div class="spot-panel-title-row">
    <div class="spot-panel-title">{{ store.currentItem?.name }}</div>
    <button class="spot-panel-close" aria-label="Schließen" @click="onClose">✕</button>
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
        @click="onLike"
      >
        <template v-if="store.isLiked">⭐</template>
        <i v-else class="fa-regular fa-star"></i>
      </button>
      <button
        class="spot-action-btn spot-share-btn"
        :class="{ hidden: !store.currentItem?.approved }"
        aria-label="Teilen"
        @click="onShare"
      >
        <i class="fas fa-share-alt"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Live island mounted by src/map/spot_panel/spotPanel.ts into
// #spot-panel-header (see the migration spec's "island mechanism" and
// spotPanel.ts's renderHeader()). Replaces the header block of
// buildDOM()'s innerHTML plus the DOM writes in openInternal()/
// updateLikeButton() (Phase 4 of the spot-panel Vue migration). Reads
// title/org-link/share-visibility straight off store.currentItem — the
// same field spotPanel.ts already keeps in sync for the Parking slice, no
// duplicate state needed. isLiked/likeVisible are new store fields this
// phase adds, since nothing else on the store already tracks them.
//
// Like/share/close are kept as callback props (not store actions) because
// their real logic — auth checks, the like/dislike API calls, native
// share/clipboard fallback, and closing the whole panel/map layers — lives
// in spotPanel.ts, which still holds the injected Auth adapter and Leaflet
// state. Same "bound-instance-method props" shape as SpotPanelElevation.vue's
// onHover/onHoverEnd/onClose.
defineProps<{
  onLike: () => void
  onShare: () => void
  onClose: () => void
}>()

const store = useSpotPanelStore()
</script>
