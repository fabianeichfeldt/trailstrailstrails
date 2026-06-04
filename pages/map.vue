<template>
  <div class="map-page">
    <!-- Mobile top bar background — gives burger + search a clean backing -->
    <div class="mobile-topbar" />

    <ClientOnly>
      <MapView
        @ready="onMapReady"
        @nearby-conflict="onNearbyConflict"
        @spot-picked="onSpotPicked"
      />

      <SearchBar @open-trail="handleOpenTrail" @fly-to="handleFlyTo" />

      <UserAvatar />

      <!-- Add-trail FAB -->
      <div class="add-btn-wrapper" id="top-map-buttons">
        <div class="fab-menu hidden" id="fab-menu">
          <button class="fab-item" data-type="trail">Trail Spot</button>
          <button class="fab-item" data-type="bikepark">Bikepark eintragen</button>
          <button class="fab-item" data-type="dirtpark">Dirtpark / Pumptrack</button>
        </div>
        <button class="add-trail-btn" id="add-btn">+</button>
      </div>

      <button class="location-btn" @click="flyToUserLocation" aria-label="Meinen Standort anzeigen">
        <i class="fa-solid fa-location-crosshairs"></i>
      </button>

      <Drawer />
      <NearbyModal :conflict="nearbyConflict" />
      <AddSpotModal
        :open="addSpotModal.open"
        :lat="addSpotModal.lat"
        :lng="addSpotModal.lng"
        :initial-type="addSpotModal.type"
        @close="addSpotModal.open = false"
      />
    </ClientOnly>

    <AuthModal />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'map' })

useSeoMeta({
  title: 'Karte – Trailradar',
  description: 'Interaktive Karte aller offiziellen Mountainbike-Trails, Bikeparks und Pumptracks in Deutschland.',
  ogUrl: 'https://trailradar.org/map',
  ogSiteName: 'Trailradar.org',
  ogLocale: 'de_DE',
})
useHead({
  link: [{ rel: 'canonical', href: 'https://trailradar.org/map' }],
})

const authStore = useAuthStore()
const mapStore = useMapStore()
const trailsStore = useTrailsStore()
const route = useRoute()

let openTrail = (_id: string) => {}
let flyToPlace = (_lat: number, _lon: number) => {}
const nearbyConflict = ref<{ trail: any; resolve: (proceed: boolean) => void } | null>(null)
const addSpotModal = reactive({ open: false, lat: 0, lng: 0, type: 'trail' })

const trailIdFromQuery = route.query.trail as string | undefined

function onMapReady(handlers: { openTrail: (id: string) => void; flyToPlace: (lat: number, lon: number) => void }) {
  openTrail = handlers.openTrail
  flyToPlace = handlers.flyToPlace

  // Open trail from query param — only after map is ready so openTrail is the real function
  if (trailIdFromQuery) {
    if (trailsStore.all.length > 0) {
      openTrail(trailIdFromQuery)
    } else {
      let stop: () => void
      stop = watch(() => trailsStore.all.length, (n) => {
        if (n > 0) { openTrail(trailIdFromQuery); stop() }
      })
    }
  }
}

function handleOpenTrail(id: string) { openTrail(id) }
function handleFlyTo(lat: number, lon: number) { flyToPlace(lat, lon) }

function onSpotPicked(pick: { lat: number; lng: number; type: string }) {
  addSpotModal.lat = pick.lat
  addSpotModal.lng = pick.lng
  addSpotModal.type = pick.type
  addSpotModal.open = true
}

function onNearbyConflict(conflict: { trail: any; resolve: (proceed: boolean) => void }) {
  const origResolve = conflict.resolve
  nearbyConflict.value = {
    ...conflict,
    resolve: (v) => {
      nearbyConflict.value = null
      origResolve(v)
    },
  }
}

function flyToUserLocation() {
  if (mapStore.userLocation) {
    flyToPlace(mapStore.userLocation[0], mapStore.userLocation[1])
  }
}
</script>

<style scoped>
.map-page {
  position: fixed;
  inset: 0;
  overflow: hidden;
}

.mobile-topbar {
  display: none;
}

@media (max-width: 600px) {
  .mobile-topbar {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 62px;
    background: white;
    box-shadow: 0 1px 6px rgba(0,0,0,0.12);
    z-index: 1050;
  }
}

.add-btn-wrapper {
  position: absolute;
  right: 10px;
  bottom: 5.5em;
  z-index: 1000;
}

.fab-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 9999;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(6px);
  padding: 8px;
  border-radius: 10px;
  box-shadow: 0 3px 8px rgba(0,0,0,0.25);
}
.fab-menu.hidden { display: none; }

.fab-item {
  background: #fff; border: 1px solid #2b6cb0;
  border-radius: 6px; padding: 0.3em 0.6em;
  font-size: 0.75em; text-align: start; cursor: pointer; white-space: nowrap;
}
.fab-item:hover { background: #eef6ff; }

.add-trail-btn {
  background: #2b6cb0; color: white; border: none;
  border-radius: 0.4em;
  min-width: 44px; min-height: 44px;
  padding: 0 0.9em;
  cursor: pointer; font-size: 0.85em; font-weight: 600;
  box-shadow: 0 3px 6px rgba(0,0,0,0.25);
  display: flex; align-items: center; justify-content: center;
}
.add-trail-btn:hover { background: #3182ce; }
.add-trail-btn.active { background: #38a169; }

.location-btn {
  position: absolute;
  right: 10px;
  bottom: 8em;
  z-index: 1000;
  background: #2b6cb0;
  color: white;
  border: none;
  border-radius: 0.4em;
  min-width: 44px; min-height: 44px;
  padding: 0;
  cursor: pointer;
  font-size: 1em;
  box-shadow: 0 3px 6px rgba(0,0,0,0.25);
  display: flex; align-items: center; justify-content: center;
}
.location-btn:hover { background: #3182ce; }
</style>
