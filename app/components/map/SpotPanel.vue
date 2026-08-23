<template>
  <!-- `hidden` class (not v-if) is load-bearing: spot_panel.css and
       tests/spot-panel-*.spec.ts both select on it directly. -->
  <div ref="panelEl" class="spot-panel" :class="{ open: store.isOpen }">
    <div class="spot-panel-handle" role="presentation"><div class="spot-panel-handle-bar"></div></div>
    <div class="spot-panel-header"><SpotPanelHeader /></div>
    <div class="spot-panel-tabs"><SpotPanelTabs /></div>
    <div class="spot-panel-content-area">
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
  </div>
</template>

<script setup lang="ts">
import { initDragHandle, isDesktopViewport, snapTo, playInviteBounce } from '~/map/spot_panel/dragHandle'
import SpotPanelHeader from './SpotPanelHeader.vue'
import SpotPanelTabs from './SpotPanelTabs.vue'
import SpotPanelInfoTab from './SpotPanelInfoTab.vue'
import SpotPanelToursTab from './SpotPanelToursTab.vue'
import SpotPanelTrailsTab from './SpotPanelTrailsTab.vue'
import SpotPanelParkingTab from './SpotPanelParkingTab.vue'
import SpotPanelElevation from './SpotPanelElevation.vue'

// Mounts as a sibling of <MapView> in app/pages/map.vue, same pattern as
// Drawer.vue/NearbyModal.vue/AddSpotModal.vue.
const store = useSpotPanelStore()

const elevationVisible = computed(() => store.selectedItemId !== null && store.selectedItemKind !== null)

// Kept as callback props rather than store state: a store mutation on every
// mousemove would pay Vue reactivity/devtools cost for an effect only the
// map (useTrailMap.ts's hover marker) ever observes. Threaded down via
// MapView.vue's `ready` event -> map.vue -> here -> SpotPanelElevation.vue,
// same as openTrail/flyToPlace.
defineProps<{
  onHover: (latlng: [number, number], color: string) => void
  onHoverEnd: () => void
}>()

// No L.DomEvent.disableClickPropagation() needed: .spot-panel is a sibling
// of the Leaflet container, not a descendant, so clicks inside it can't
// bubble into Leaflet's map-click handler. Also keeps Leaflet (`L`) out of
// this file — useTrailMap.ts is the only place it should exist.
const panelEl = ref<HTMLElement | null>(null)
onMounted(() => {
  if (panelEl.value) initDragHandle(panelEl.value)
})

// Picking a tour/trail opens the elevation drill-in (elevationVisible
// above) — on mobile, give it the whole sheet instead of squeezing the list
// beside it (see dragHandle.ts's snap points). Only fires on the
// null -> non-null transition, not on every subsequent row switch while
// already selected. Desktop's panel is already near-full-height, so
// there's nothing worth snapping there.
watch(
  () => [store.selectedItemId, store.selectedItemKind] as const,
  ([id, kind], prev) => {
    const [prevId, prevKind] = prev ?? [null, null]
    const wasSelected = prevId !== null && prevKind !== null
    const isSelected = id !== null && kind !== null
    if (!wasSelected && isSelected && panelEl.value && !isDesktopViewport()) {
      snapTo(panelEl.value, 'full')
    }
  },
)

// One nudge, the first time the sheet opens in this page load — not on
// every open, or it'd just become idle wobble. Plain closure flag rather
// than a ref: nothing else needs to read or react to it.
let hasPlayedOpenBounce = false
watch(
  () => store.isOpen,
  (open) => {
    if (open && !hasPlayedOpenBounce && panelEl.value && !isDesktopViewport()) {
      hasPlayedOpenBounce = true
      // Wait out the sheet's own 0.32s open-slide transition first — playing
      // the bounce mid-slide would fight it instead of reading as a settle.
      window.setTimeout(() => {
        if (panelEl.value) playInviteBounce(panelEl.value)
      }, 380)
    }
  },
)
</script>
