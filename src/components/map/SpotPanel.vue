<template>
  <div ref="panelEl" class="spot-panel" :class="{ open: store.isOpen }">
    <div class="spot-panel-handle" role="presentation"></div>
    <div class="spot-panel-header"><SpotPanelHeader /></div>
    <div class="spot-panel-tabs"><SpotPanelTabs /></div>
    <div class="spot-panel-body">
      <div class="spot-tab-content" id="spot-info-tab" :class="{ hidden: store.activeTab !== 'info' }">
        <SpotPanelInfoTab />
      </div>
      <div class="spot-tab-content" id="spot-tours-tab" :class="{ hidden: store.activeTab !== 'tours' }">
        <SpotPanelToursTab />
      </div>
      <div class="spot-tab-content" id="spot-trails-tab" :class="{ hidden: store.activeTab !== 'trails' }">
        <SpotPanelTrailsTab />
      </div>
      <div class="spot-tab-content" id="spot-parking-tab" :class="{ hidden: store.activeTab !== 'parking' }">
        <SpotPanelParkingTab :lots="store.parkingLots" :highlight-id="store.highlightedParkingLotId ?? undefined" />
      </div>
    </div>
    <div class="spot-elevation-panel" :class="{ hidden: !elevationVisible }">
      <div id="spot-elevation-content">
        <SpotPanelElevation :on-hover="onHover" :on-hover-end="onHoverEnd" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { initDragHandle } from '~/map/spot_panel/dragHandle'
import SpotPanelHeader from './SpotPanelHeader.vue'
import SpotPanelTabs from './SpotPanelTabs.vue'
import SpotPanelInfoTab from './SpotPanelInfoTab.vue'
import SpotPanelToursTab from './SpotPanelToursTab.vue'
import SpotPanelTrailsTab from './SpotPanelTrailsTab.vue'
import SpotPanelParkingTab from './SpotPanelParkingTab.vue'
import SpotPanelElevation from './SpotPanelElevation.vue'

// Top-level shell — mounts as a sibling of <MapView> in src/pages/map.vue,
// same pattern as Drawer.vue/NearbyModal.vue/AddSpotModal.vue. Replaces the
// vanilla spotPanel.ts class (Phase 5b, the final phase of the spot-panel
// Vue migration — see
// docs/superpowers/specs/2026-08-13-spot-panel-vue-migration-design.md).
// Assembles every tab/section island built in Phases 1-5a as real Vue child
// components instead of createApp()-mounted islands into raw innerHTML
// containers — there's no more legacy DOM shell to mount into.
//
// Pane visibility (tab content, the elevation panel) is now derived
// reactively straight off the store on every render — replacing the old
// applyTab()'s imperative classList.add/remove('hidden') writes and the
// suppressNextTabWatch double-run guard that existed only to keep those
// writes from firing twice for one store change. The `hidden` CSS class is
// kept (not swapped for v-if/v-show) because src/assets/css/spot_panel.css
// and the spot-panel E2E specs (tests/spot-panel-*.spec.ts) both key off
// that exact class name.
const store = useSpotPanelStore()

const elevationVisible = computed(() => store.selectedItemId !== null && store.selectedItemKind !== null)

// Hover bridge (elevation chart <-> map marker) — threaded down as plain
// props from useTrailMap.ts's Leaflet-side hover marker, via MapView.vue's
// `ready` event -> map.vue -> here -> SpotPanelElevation.vue, exactly like
// openTrail/flyToPlace already reach map.vue today. Kept as callbacks (not
// store state) since a store mutation on every mousemove would pay Vue
// reactivity/devtools cost for an effect only the map ever observes.
defineProps<{
  onHover: (latlng: [number, number], color: string) => void
  onHoverEnd: () => void
}>()

// .spot-panel is no longer appended inside the Leaflet container div (see
// the migration spec's CSS positioning risk item) — it's a template-native
// sibling of <MapView> now, so L.DomEvent.disableClickPropagation()/
// disableScrollPropagation() (used by the vanilla buildDOM() to stop clicks
// on the panel bubbling into Leaflet's own map-click handler) are no longer
// needed at all: clicks inside .spot-panel can't bubble into
// .leaflet-container in the first place, since the two are siblings, not
// ancestor/descendant. This also keeps Leaflet (`L`) out of this file,
// preserving CLAUDE.md's "useTrailMap.ts is the only place Leaflet L
// exists" rule.
const panelEl = ref<HTMLElement | null>(null)
onMounted(() => {
  if (panelEl.value) initDragHandle(panelEl.value)
})
</script>
