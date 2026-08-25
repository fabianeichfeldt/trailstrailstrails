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
      <button class="spot-elevation-close" aria-label="Höhenprofil schließen" @click="store.clearSelection()">✕</button>
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

// onHover/onHoverEnd are callback props, not store state — kept that way
// even though the routed spot-detail page (app/pages/trails/[slug].vue)
// now always passes no-ops: elevation-hover-highlighting-the-map-marker
// was dropped when this component moved from the SpotPanel bottom-sheet
// (which sat over the live, interactive map) onto that page (which only
// embeds a read-only map iframe with nothing to highlight — see the
// spec's "Known behavior changes"). Kept as props rather than deleted so
// this component doesn't need to know it no longer has a live map to
// report hover events to.
const props = defineProps<{
  onHover: (latlng: [number, number], color: string) => void
  onHoverEnd: () => void
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
// colored slices when the tour itself has no single real GPX recording.
const segments = computed<TourSegment[] | undefined>(() => {
  if (store.selectedItemKind !== 'tour' || !item.value) return undefined
  const tour = item.value as MtbTour
  return tour.hasFullGpx ? undefined : tour.segments
})

const elevationSvgHtml = computed(() => (item.value ? elevationSVG(profile.value, item.value, segments.value) : ''))

const chartEl = ref<HTMLElement | null>(null)
const statusEl = ref<HTMLElement | null>(null)

// Appends the trail-status card imperatively — trailStatusCardFor() returns
// an HTMLElement, not markup, so it can't go through v-html — and (re)binds
// hover listeners on the freshly-rendered <svg>. Must run via onMounted()
// + a non-immediate watch() below, not a single `watch(item, ...,
// { immediate: true })`: an immediate watcher fires during setup(), before
// chartEl/statusEl are populated, and would silently no-op.
async function syncStatusAndHover(newItem: AnyItem | null) {
  if (statusEl.value) {
    statusEl.value.innerHTML = ''
    if (newItem) {
      const card = trailStatusCardFor(newItem, store.currentItem?.name ?? '')
      if (card) statusEl.value.appendChild(card)
    }
  }

  if (!newItem) return
  // v-html is reactive but not synchronous — wait for Vue to patch the DOM
  // before querying the <svg> it produced.
  await nextTick()
  const svgEl = chartEl.value?.querySelector('svg') as SVGSVGElement | null
  if (svgEl) bindElevationHover(svgEl, newItem, props.onHover, props.onHoverEnd)
}

onMounted(() => syncStatusAndHover(item.value))
watch(item, (newItem) => syncStatusAndHover(newItem))
</script>
