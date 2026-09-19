<template>
  <!-- Stable SSR/prerender placeholder: an empty, correctly-sized <div> that
       Leaflet mutates in place after mount (client-only). Identical markup
       server- and client-side, so no hydration mismatch. `.trail-map` (from
       app/pages/trails/[slug].vue) fixes its height so the section doesn't
       jump when the map initialises.
       Test hooks: `data-testid="spot-minimap"` for the container, and
       `data-fly="lat,lng,zoom"` — the current view target, seeded with the
       spot centre once the map inits and updated on every flyTo() — so E2E
       can assert without reaching into Leaflet internals. -->
  <div
    ref="mapEl"
    class="trail-map"
    data-testid="spot-minimap"
    :data-fly="flyState || undefined"
  />
</template>

<script setup lang="ts">
import type { Trail } from '~/types/Trail'
import type { SpotMtbData } from '~/types/MtbTypes'
import type { SpotParkingLot } from '~/communication/trails'
import { createMiniMap, type MiniMapHandle, type MiniMapInput } from '~/map/miniMap'
import 'leaflet-gesture-handling/dist/leaflet-gesture-handling.css'

const SPOT_ZOOM = 11
const FOCUS_ZOOM = 14

const props = defineProps<{
  spot: Trail
  data: SpotMtbData | null
  parking: SpotParkingLot[]
  focus: { lat: number; lng: number; zoom?: number } | null
}>()

// Wired here, not inside app/map/ — miniMap.ts must not import stores.
const spotPanelStore = useSpotPanelStore()

const mapEl = ref<HTMLElement | null>(null)
const flyState = ref<string | null>(null)

function buildInput(): MiniMapInput {
  const polylines: MiniMapInput['polylines'] = []
  for (const tour of props.data?.tours ?? []) {
    polylines.push({ id: tour.id, kind: 'tour', name: tour.name, difficulty: null, points: tour.gpxPoints })
  }
  for (const trail of props.data?.trails ?? []) {
    polylines.push({ id: trail.id, kind: 'trail', name: trail.name, difficulty: trail.difficulty ?? null, points: trail.gpxPoints })
  }

  const markers: MiniMapInput['markers'] = [
    {
      lat: props.spot.latitude,
      lng: props.spot.longitude,
      kind: 'spot',
      spotType: props.spot.type,
      approved: props.spot.approved,
      name: props.spot.name,
    },
    ...props.parking.map(lot => ({
      lat: lot.lat,
      lng: lot.lng,
      kind: 'parking' as const,
      name: lot.name,
    })),
  ]

  return {
    center: [props.spot.latitude, props.spot.longitude],
    zoom: SPOT_ZOOM,
    polylines,
    markers,
  }
}

// createMiniMap() is async (awaits the Leaflet dynamic import); the component
// can be torn down before it resolves. Register the teardown synchronously in
// setup and guard the post-await path — same shape as app/pages/embed/[token].vue.
let handle: MiniMapHandle | null = null
let destroyed = false
onUnmounted(() => {
  destroyed = true
  handle?.destroy()
})

function flyTo(lat: number, lng: number, zoom: number) {
  flyState.value = `${lat},${lng},${zoom}`
  handle?.flyTo(lat, lng, zoom)
}

onMounted(async () => {
  // Never during SSR/prerender (onMounted doesn't run there, but be explicit —
  // the component test asserts this guard).
  if (import.meta.server || !mapEl.value) return

  handle = await createMiniMap(mapEl.value, buildInput(), {
    interactive: true,
    onPolylineActivate: p => spotPanelStore.selectItem(p.id, p.kind),
  })
  if (destroyed) {
    handle.destroy()
    handle = null
    return
  }
  flyState.value = `${props.spot.latitude},${props.spot.longitude},${SPOT_ZOOM}`

  // GPX (props.data) is null until loadSpotData resolves post-mount; parking
  // arrives separately. Sync once now in case either landed during the
  // createMiniMap await, then re-render the layers as each subsequent
  // change lands.
  handle.setData(buildInput())
  watch(
    () => [props.data, props.parking],
    () => handle?.setData(buildInput()),
    { deep: true },
  )

  // A selected tour/trail/parking lot flies the map to it; deselecting flies
  // back to the spot.
  watch(
    () => props.focus,
    (focus) => {
      if (focus) flyTo(focus.lat, focus.lng, focus.zoom ?? FOCUS_ZOOM)
      else flyTo(props.spot.latitude, props.spot.longitude, SPOT_ZOOM)
    },
  )
})
</script>
