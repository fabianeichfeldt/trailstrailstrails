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
// Live island mounted by src/map/spot_panel/spotPanel.ts into
// #spot-panel-tabs (see the migration spec's "island mechanism" and
// spotPanel.ts's renderTabs()). Replaces the tab-button markup in
// buildDOM()'s innerHTML plus updateTabsVisibility() (Phase 4 of the
// spot-panel Vue migration). Owns only the button bar — which one is
// highlighted, which are visible, and writing a click to store.activeTab.
// The four #spot-*-tab content panes stay owned by spotPanel.ts (already
// separately-managed islands for Tours/Trails/Parking, or legacy innerHTML
// for Info) — spotPanel.ts watches store.activeTab to toggle them.
//
// isTrail/parkingVisible reuse fields already on the store from earlier
// phases (currentItem, parkingTabForceVisible, parkingLots) — no new store
// fields needed for visibility, only activeTab/isLiked/likeVisible (added
// this phase) are new.
const store = useSpotPanelStore()

const isTrail = computed(() => store.currentItem?.type === 'trail')
const parkingVisible = computed(() => store.parkingTabForceVisible || store.parkingLots.length > 0)

function select(tab: 'info' | 'tours' | 'trails' | 'parking') {
  store.setActiveTab(tab)
}
</script>
