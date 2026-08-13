<template>
  <div class="spot-elevation-header">
    <span class="spot-elevation-name">{{ item?.name }}</span>
    <div class="spot-elevation-actions">
      <a
        v-if="item?.gpx_url"
        class="spot-elevation-download"
        :href="item.gpx_url"
        :download="`${item.name}.gpx`"
        aria-label="GPX herunterladen"
      ><i class="fas fa-download"></i></a>
      <button class="spot-elevation-close" aria-label="Höhenprofil schließen" @click="onClose">✕</button>
    </div>
  </div>
  <div ref="chartEl" class="spot-elevation-chart" v-html="elevationSvgHtml"></div>
  <div v-if="item" class="spot-elevation-stats">
    <span>📍 {{ item.distance_km }} km</span>
    <span>↑ {{ item.elevation_gain }} m</span>
    <span>↓ {{ item.elevation_loss }} m</span>
    <span>{{ DIR_LABEL[item.direction] }}</span>
  </div>
  <div ref="statusEl" class="spot-elevation-status"></div>
</template>

<script setup lang="ts">
import type { MtbTour, TourSegment } from '~/types/MtbTypes'
import { elevationSVG, bindElevationHover, type AnyItem } from '~/map/spot_panel/elevationSvg'
import { DIR_LABEL, trailStatusCardFor } from '~/map/spot_panel/spotPanelHtml'

// Live island mounted by src/map/spot_panel/spotPanel.ts into
// #spot-elevation-content (see the migration spec's "island mechanism" and
// spotPanel.ts's renderElevation()). Replaces the DOM manipulation in the
// vanilla showElevation()/closeElevation() (Phase 3 of the spot-panel Vue
// migration). Reads useSpotPanelStore() directly for the selected item —
// only the hover bridge and the close trigger cross back out as props,
// since bindElevationHover()'s onHover/onLeave callbacks touch
// spotPanel.ts's own hoverMarker/overlayLayer Leaflet fields (not moved to
// useTrailMap.ts until the Phase 5 shell replacement deletes this class).
const props = defineProps<{
  onHover: (latlng: [number, number], color: string) => void
  onHoverEnd: () => void
  onClose: () => void
}>()

const store = useSpotPanelStore()

const item = computed<AnyItem | null>(() => {
  const data = store.data
  if (!data || !store.selectedItemId) return null
  if (store.selectedItemKind === 'tour') {
    return data.tours.find(t => t.id === store.selectedItemId) ?? null
  }
  if (store.selectedItemKind === 'trail') {
    return data.trails.find(t => t.id === store.selectedItemId) ?? null
  }
  return null
})

const profile = computed(() => item.value?.elevationProfile ?? [])

// A tour's individually-recorded segments are only rendered as distinct
// colored slices when the tour itself has no single real GPX recording
// (hasFullGpx === false) — same condition the vanilla selectTour() used.
const segments = computed<TourSegment[] | undefined>(() => {
  if (store.selectedItemKind !== 'tour' || !item.value) return undefined
  const tour = item.value as MtbTour
  return tour.hasFullGpx ? undefined : tour.segments
})

const elevationSvgHtml = computed(() => (item.value ? elevationSVG(profile.value, item.value, segments.value) : ''))

const chartEl = ref<HTMLElement | null>(null)
const statusEl = ref<HTMLElement | null>(null)

/**
 * Appends the trail-status card (imperative DOM — trailStatusCardFor()
 * returns an HTMLElement, not markup, so it can't go through v-html) and
 * (re)binds the elevation-chart hover listeners on the freshly-rendered
 * <svg>. Depends on both template refs (chartEl/statusEl) being populated,
 * so it must never run before mount — see the onMounted()/watch() split
 * below, not a single `watch(item, ..., { immediate: true })`, which would
 * fire this during setup() while both refs are still null.
 */
async function syncStatusAndHover(newItem: AnyItem | null) {
  if (statusEl.value) {
    statusEl.value.innerHTML = ''
    if (newItem) {
      const card = trailStatusCardFor(newItem, store.currentItem?.name ?? '')
      if (card) statusEl.value.appendChild(card)
    }
  }

  if (!newItem) return
  // v-html above is reactive but not synchronous — wait for Vue to actually
  // patch the DOM before querying the <svg> it produced (documented gotcha
  // in the migration spec: nextTick(), not requestAnimationFrame).
  await nextTick()
  const svgEl = chartEl.value?.querySelector('svg') as SVGSVGElement | null
  if (svgEl) bindElevationHover(svgEl, newItem, props.onHover, props.onHoverEnd)
}

// Refs are guaranteed populated by mount time — handles whatever item is
// already selected when this island gets mounted.
onMounted(() => syncStatusAndHover(item.value))
// Handles every subsequent selection change. Not `immediate: true` — the
// mount-time case above already covers the initial state.
watch(item, (newItem) => syncStatusAndHover(newItem))
</script>
