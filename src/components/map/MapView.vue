<template>
  <div ref="mapEl" data-testid="map-container" class="map-container" />
</template>

<script setup lang="ts">
const props = defineProps<{
  onOpenTrail?: (id: string) => void
  onFlyTo?: (lat: number, lon: number) => void
}>()

const emit = defineEmits<{
  ready: [{ openTrail: (id: string) => void; flyToPlace: (lat: number, lon: number) => void }]
  nearbyConflict: [{ trail: any; resolve: (proceed: boolean) => void }]
  spotPicked: [{ lat: number; lng: number; type: string }]
}>()

const mapEl = ref<HTMLElement | null>(null)
const { openTrail, flyToPlace, nearbyConflict, addSpotPicked } = useTrailMap(mapEl)

watch(nearbyConflict, (v) => {
  if (v) emit('nearbyConflict', v)
})

watch(addSpotPicked, (v) => {
  if (v) {
    emit('spotPicked', v)
    addSpotPicked.value = null
  }
})

onMounted(() => {
  emit('ready', { openTrail, flyToPlace })
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
}
</style>
