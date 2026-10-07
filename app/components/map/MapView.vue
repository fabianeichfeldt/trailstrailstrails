<template>
  <div
    ref="mapEl"
    data-testid="map-container"
    class="map-container"
  />
</template>

<script setup lang="ts">
import '../../css/soil_radar.css'

const filtersStore = useFiltersStore()
const soilStore = useSoilRadarStore()

const props = defineProps<{
  onOpenTrail?: (id: string) => void
  onFlyTo?: (lat: number, lon: number) => void
}>()

const emit = defineEmits<{
  ready: [{
    openTrail: (id: string) => void
    flyToPlace: (lat: number, lon: number) => void
    getCenter: () => { lat: number; lon: number } | null
  }]
  soilCounts: [{ matchCount: number; totalCount: number }]
  nearbyConflict: [{ trail: any; resolve: (proceed: boolean) => void }]
  spotPicked: [{ lat: number; lng: number; type: string }]
}>()

const mapEl = ref<HTMLElement | null>(null)

// classList, not a :class binding: Vue would overwrite the whole class attribute and wipe the `leaflet-*` classes Leaflet added.
watchEffect(() => {
  const el = mapEl.value
  if (!el) return
  el.classList.toggle('map-grayscale', filtersStore.grayscaleMap)
  el.classList.toggle('soil-radar-on', soilStore.enabled)
}, { flush: 'post' })
const { openTrail, flyToPlace, nearbyConflict, addSpotPicked, mapReady, soilCounts, getCenter } = useTrailMap(mapEl)

watch(nearbyConflict, (v) => {
  if (v) emit('nearbyConflict', v)
})

watch(addSpotPicked, (v) => {
  if (v) {
    emit('spotPicked', v)
    addSpotPicked.value = null
  }
})

// Emitted off mapReady (true once useTrailMap's openTrail/flyToPlace are
// actually callable), not a plain onMounted — see mapReady's comment in
// useTrailMap.ts for the race that would otherwise cause.
watch(mapReady, (ready) => {
  if (ready) emit('ready', { openTrail, flyToPlace, getCenter })
})

watch(soilCounts, c => emit('soilCounts', c), { immediate: true })
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
}

/* Tiles get the strong tint; markers only a light one so status colors stay readable. GPX polylines and popups keep full color. */
.map-grayscale :deep(.leaflet-tile-pane) {
  filter: grayscale(0.65);
}
.map-grayscale :deep(.leaflet-marker-pane) {
  filter: grayscale(0.2);
}
/* Badge colours and glow must stay true while the radar is on. */
.map-grayscale.soil-radar-on :deep(.leaflet-marker-pane) {
  filter: none;
}
</style>
