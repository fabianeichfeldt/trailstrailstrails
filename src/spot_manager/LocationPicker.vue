<template>
  <div class="lp-wrap">
    <div ref="mapEl" class="lp-map" />
    <p class="lp-hint">
      <i class="fas fa-hand-pointer" />
      {{ modelValue ? 'Klicken oder Pin ziehen, um den Standort zu ändern' : 'Klicken, um den Standort zu setzen' }}
    </p>
  </div>
</template>

<script setup lang="ts">
// Small, form-embeddable Leaflet location picker — click-to-place + draggable
// pin. Lives in src/spot_manager/ (not src/map/) so SpotManagerApp.vue keeps
// its "no src/map/ import" architecture invariant; consistent with how
// spot_manager/MapView.ts already owns its own separate Leaflet instance.
import { clickEventToLatLng, type LatLng } from './locationPickerUtils'
import { parkingIconOptions } from '../map/markerIcon'

const props = defineProps<{
  modelValue: LatLng | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: LatLng]
}>()

const mapEl = ref<HTMLElement | null>(null)
const DEFAULT_CENTER: LatLng = { lat: 51.0, lng: 10.5 }
const DEFAULT_ZOOM = 6
const PLACED_ZOOM = 14

let map: any = null
let marker: any = null
let L: any = null

function placeMarker(pos: LatLng) {
  if (!map || !L) return
  if (!marker) {
    marker = L.marker([pos.lat, pos.lng], {
      icon: L.divIcon(parkingIconOptions()),
      draggable: true,
    }).addTo(map)
    marker.on('dragend', () => {
      const ll = marker.getLatLng()
      emit('update:modelValue', clickEventToLatLng({ latlng: { lat: ll.lat, lng: ll.lng } }))
    })
  } else {
    marker.setLatLng([pos.lat, pos.lng])
  }
}

onMounted(async () => {
  if (!mapEl.value) return
  L = (await import('leaflet')).default

  const start = props.modelValue ?? DEFAULT_CENTER
  map = L.map(mapEl.value, { zoomControl: true })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)
  map.setView([start.lat, start.lng], props.modelValue ? PLACED_ZOOM : DEFAULT_ZOOM)

  if (props.modelValue) placeMarker(props.modelValue)

  map.on('click', (e: any) => {
    const pos = clickEventToLatLng(e)
    placeMarker(pos)
    emit('update:modelValue', pos)
  })
})

onUnmounted(() => {
  map?.remove()
  map = null
  marker = null
})

// Keep the pin in sync if the parent resets modelValue (e.g. switching to
// a different lot in the editor without remounting the picker).
watch(() => props.modelValue, (val) => {
  if (!val || !map) return
  placeMarker(val)
})
</script>

<style scoped>
.lp-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lp-map {
  width: 100%;
  height: 220px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  /* Leaflet needs an explicit stacking context so its panes don't leak
     above the rest of the SpotManager UI (modals, tab bar, etc.) */
  position: relative;
  z-index: 0;
}

.lp-hint {
  margin: 0;
  font-size: 11px;
  color: #9ca3af;
}
.lp-hint i { margin-right: 4px; }

/* Touch targets: the draggable pin already renders at 22px via
   parkingIconOptions(); Leaflet adds its own generous hit area around
   markers so dragging remains usable on mobile without further tuning. */
@media (max-width: 600px) {
  .lp-map { height: 180px; }
}
</style>
