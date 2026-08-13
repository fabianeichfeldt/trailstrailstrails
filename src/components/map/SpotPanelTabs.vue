<template>
  <button
    class="spot-tab"
    :class="{ active: store.activeTab === 'info' }"
    data-tab="info"
    @click="select('info')"
  >Spot-Info</button>
  <button
    v-if="isTrail"
    class="spot-tab"
    :class="{ active: store.activeTab === 'tours' }"
    data-tab="tours"
    @click="select('tours')"
  >Touren</button>
  <button
    v-if="isTrail"
    class="spot-tab"
    :class="{ active: store.activeTab === 'trails' }"
    data-tab="trails"
    @click="select('trails')"
  >Trails</button>
  <button
    v-if="parkingVisible"
    class="spot-tab"
    :class="{ active: store.activeTab === 'parking' }"
    data-tab="parking"
    @click="select('parking')"
  >Parkplätze</button>
</template>

<script setup lang="ts">
// Owns only the tab-button bar (highlighting, visibility, writing clicks to
// store.activeTab) — the four content panes are separate components in
// SpotPanel.vue, which reads activeTab reactively to toggle them.
const store = useSpotPanelStore()

const isTrail = computed(() => store.currentItem?.type === 'trail')
const parkingVisible = computed(() => store.parkingTabForceVisible || store.parkingLots.length > 0)

function select(tab: 'info' | 'tours' | 'trails' | 'parking') {
  store.setActiveTab(tab)
}
</script>
