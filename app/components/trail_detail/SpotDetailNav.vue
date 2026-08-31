<template>
  <nav class="spot-detail-nav" aria-label="Abschnitte">
    <a v-if="isTrail" class="spot-detail-nav-link" href="#touren">Touren</a>
    <a v-if="isTrail" class="spot-detail-nav-link" href="#trails">Trails</a>
    <a v-if="parkingVisible" class="spot-detail-nav-link" href="#parking">Parkplätze</a>
    <a class="spot-detail-nav-link" href="#description">Info</a>
    <a class="spot-detail-nav-link" href="#comments">Kommentare</a>
  </nav>
</template>

<script setup lang="ts">
import type { Trail } from '~/types/Trail'

// Long-scroll replacement for SpotPanelTabs.vue's tab-switch bar — plain
// anchor links into the page's sections instead of a `store.activeTab`
// state machine (Decision 3/4 in the spot-detail-real-pages spec: sections,
// not tabs; sticky from page load, no scroll-position tracking).
const props = defineProps<{ trail: Trail; parkingCount: number }>()

const isTrail = computed(() => props.trail.type === 'trail')
const parkingVisible = computed(() => props.parkingCount > 0)
</script>

<style scoped>
.spot-detail-nav {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  gap: 0.4em;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0.6em 1em;
  margin: 0 -1em 1em;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #e4e9f0;
  scrollbar-width: none;
}
.spot-detail-nav::-webkit-scrollbar { display: none; }

.spot-detail-nav-link {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  padding: 0 1em;
  border-radius: 999px;
  background: #eef1f5;
  color: #4a5568;
  font-size: 0.82em;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
.spot-detail-nav-link:hover {
  background: #1a2035;
  color: #fff;
}

@media (min-width: 600px) {
  .spot-detail-nav {
    margin-left: 0;
    margin-right: 0;
    border-radius: 10px;
    border: 1px solid #e4e9f0;
  }
}
</style>
