<template>
  <div class="map-page">
    <ClientOnly>
      <MapView
        @ready="onMapReady"
        @nearby-conflict="onNearbyConflict"
      />

      <SearchBar @open-trail="openTrail" @fly-to="flyToPlace" />

      <UserAvatar />

      <!-- Add-trail FAB (logged-in users only) -->
      <div v-if="authStore.isLoggedIn" class="add-btn-wrapper" id="top-map-buttons">
        <div class="fab-menu hidden" id="fab-menu">
          <button class="fab-item" data-type="trail">🚵 Trail eintragen</button>
          <button class="fab-item" data-type="bikepark">🏔️ Bikepark eintragen</button>
          <button class="fab-item" data-type="dirtpark">🌿 Dirtpark / Pumptrack</button>
        </div>
        <button class="add-trail-btn" id="add-btn">+</button>
      </div>

      <button class="location-btn" @click="flyToUserLocation" aria-label="Meinen Standort anzeigen">
        <i class="fa-solid fa-location-crosshairs"></i>
      </button>

      <Drawer />
      <NearbyModal :conflict="nearbyConflict" />
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

function onMapReady(handlers: { openTrail: (id: string) => void; flyToPlace: (lat: number, lon: number) => void }) {
  openTrail = handlers.openTrail
  flyToPlace = handlers.flyToPlace
}

// Auto-open trail from ?trail=<id> query param
const trailIdFromQuery = route.query.trail as string | undefined
if (trailIdFromQuery) {
  const stop = watch(
    () => trailsStore.all.length,
    (n) => {
      if (n > 0) {
        openTrail(trailIdFromQuery)
        stop()
      }
    },
    { immediate: true },
  )
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

.add-btn-wrapper {
  position: absolute;
  right: 0.4em;
  bottom: 2.5em;
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
  right: 0.75em;
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
