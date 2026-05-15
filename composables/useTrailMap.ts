import type { Ref } from 'vue'
import type { Trail } from '~/src/types/Trail'

export function useTrailMap(mapEl: Ref<HTMLElement | null>) {
  const trailsStore = useTrailsStore()
  const filtersStore = useFiltersStore()
  const authStore = useAuthStore()
  const mapStore = useMapStore()
  const user = useSupabaseUser()
  const client = useSupabaseClient()

  // Exposed for search bar
  const mapInstance = shallowRef<any>(null)
  const openTrailFn = ref<((id: string) => void) | null>(null)
  const flyToFn = ref<((lat: number, lon: number) => void) | null>(null)

  // Cleanup registered synchronously — can't call onUnmounted after await
  let cleanupFn: (() => void) | null = null
  onUnmounted(() => cleanupFn?.())

  // Nearby conflict state (replaces DOM-based modal)
  const nearbyConflict = ref<{
    trail: Trail
    resolve: (proceed: boolean) => void
  } | null>(null)

  // Emitted when user picks a location in add mode
  const addSpotPicked = ref<{ lat: number; lng: number; type: string } | null>(null)

  function openTrail(id: string) { openTrailFn.value?.(id) }
  function flyToPlace(lat: number, lon: number) { flyToFn.value?.(lat, lon) }

  onMounted(async () => {
    if (!mapEl.value) return

    // Dynamic imports — all Leaflet code runs client-only
    const L = (await import('leaflet')).default
    await import('leaflet.markercluster')

    const mymap = L.map(mapEl.value, {
      zoomControl: false,
    })

    mapInstance.value = mymap
    mymap.setMaxZoom(19)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mymap)

    L.control.zoom({ position: 'bottomright' }).addTo(mymap)

    // Cluster + plain layer
    const clusterGroup = new (L as any).MarkerClusterGroup()
    const markerGroup = L.layerGroup()
    mymap.addLayer(clusterGroup)

    const markersById = new Map<string, any>()

    function currentLayer() {
      return filtersStore.useCluster ? clusterGroup : markerGroup
    }

    function createCustomIcon(trail: Trail) {
      let category: string
      if (trail.type === 'dirtpark') category = 'dirtpark'
      else if (trail.type === 'bikepark') category = 'bikepark'
      else category = trail.approved ? 'verified' : 'unverified'
      return L.divIcon({
        html: `<div class="marker-wrapper marker-${category}"><img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png" class="marker-img" /></div>`,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        className: '',
      })
    }

    // Auth adapter bridging Pinia → legacy Auth interface
    const authAdapter = {
      authService: {
        get loggedIn() { return authStore.isLoggedIn },
        async getUser() {
          const session = await (client as any).auth.getSession()
          return {
            id: user.value?.sub ?? '',
            email: user.value?.email ?? '',
            nickname: authStore.nickname,
            accessToken: session.data.session?.access_token ?? '',
            avatarUrl: authStore.avatarUrl,
            avatarHTML: '',
          }
        },
        async signIn(email: string, password: string) {
          await authStore.signIn(email, password)
          return {} as any
        },
        async signUp(email: string, password: string, nickname: string) { return {} as any },
        async signOut() { await authStore.signOut() },
        async uploadAvatar(file: File) { return authStore.uploadAvatar(file) },
        async updatePassword(old: string, newPw: string) { return authStore.updatePassword(old, newPw) },
        async updateProfile(params: any) { return authStore.updateProfile(params) },
        async resetPassword(email: string) { return authStore.resetPassword(email) },
        async signInWithGoogle() { return authStore.signInWithGoogle() as any },
        async uploadTrailPhoto(file: File, trailId: string) { return authStore.uploadTrailPhoto(file, trailId) },
      },
      async openSignInModal() { mapStore.authModalOpen = true },
    }

    // SpotPanel
    const { SpotPanel } = await import('~/src/map/spot_panel/spotPanel')
    const spotPanel = new SpotPanel(mymap, authAdapter as any, () => {
      mapStore.panelOpen = false
    })

    function renderMarkers() {
      // Swap cluster/plain layer without remove+re-add (re-add breaks _leaflet_pos)
      if (filtersStore.useCluster) {
        if (!mymap.hasLayer(clusterGroup)) mymap.addLayer(clusterGroup)
        if (mymap.hasLayer(markerGroup)) mymap.removeLayer(markerGroup)
      } else {
        if (!mymap.hasLayer(markerGroup)) mymap.addLayer(markerGroup)
        if (mymap.hasLayer(clusterGroup)) mymap.removeLayer(clusterGroup)
      }
      clusterGroup.clearLayers()
      markerGroup.clearLayers()
      markersById.clear()

      const all: Trail[] = [
        ...trailsStore.trails,
        ...trailsStore.bikeparks,
        ...trailsStore.dirtparks,
      ]
      const visible = filtersStore.apply(all)

      for (const trail of visible) {
        const marker = L.marker([trail.latitude, trail.longitude], {
          icon: createCustomIcon(trail),
        }).addTo(currentLayer() as any)

        markersById.set(trail.id, marker)
        marker.on('click', () => {
          mapStore.panelOpen = true
          mymap.flyTo([trail.latitude, trail.longitude], 14, { duration: 1.0 })
          spotPanel.open(trail as any)
        })
      }
    }

    // Expose trail open + fly-to for search bar
    openTrailFn.value = (id: string) => {
      const trail = trailsStore.all.find(t => t.id === id)
      if (!trail) return
      mapStore.panelOpen = true
      mymap.flyTo([trail.latitude, trail.longitude], 14, { duration: 1.2 })
      spotPanel.open(trail as any)
    }
    flyToFn.value = (lat, lon) => mymap.flyTo([lat, lon], 11, { duration: 1.2 })

    // Initial location
    const { getApproxLocation } = await import('~/src/locations')
    const loc = await getApproxLocation()
    if (loc.lat !== 0 || loc.lng !== 0) {
      mymap.setView([loc.lat, loc.lng], 9)
    } else {
      mymap.setView([51.163, 10.447], 6)
    }

    // Load data and watch for changes
    await trailsStore.fetchAll()
    renderMarkers()

    watch(
      [
        () => trailsStore.trails,
        () => trailsStore.bikeparks,
        () => trailsStore.dirtparks,
        () => filtersStore.showTrails,
        () => filtersStore.showBikeparks,
        () => filtersStore.showDirtparks,
        () => filtersStore.showPumptracks,
        () => filtersStore.useCluster,
      ],
      renderMarkers,
    )

    // Geolocation
    let posMarker: any = null
    let watchId: number | null = null

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        pos => {
          const { latitude: lat, longitude: lng } = pos.coords
          mapStore.userLocation = [lat, lng]
          if (!posMarker) {
            posMarker = L.circleMarker([lat, lng], {
              radius: 8, fillColor: '#4285F4', fillOpacity: 0.9,
              color: '#1e40af', weight: 2.5, interactive: false,
            }).addTo(mymap)
          } else {
            posMarker.setLatLng([lat, lng])
          }
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 },
      )
    }

    // Add-trail FAB + map click to place
    let addMode: string | undefined
    let fabController: AbortController | null = null

    function attachFabListeners() {
      fabController?.abort()
      fabController = new AbortController()
      const signal = fabController.signal

      const addBtn = document.getElementById('add-btn') as HTMLButtonElement | null
      const fabMenu = document.getElementById('fab-menu')
      if (!addBtn || !fabMenu) return

      addBtn.addEventListener('click', () => {
        fabMenu.classList.toggle('hidden')
        addBtn.classList.toggle('active')
        if (addMode) {
          addMode = undefined
          addBtn.textContent = '+'
          mymap.getContainer().classList.remove('crosshair-cursor')
        }
      }, { signal })

      fabMenu.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        if (!target.classList.contains('fab-item')) return
        const type = target.dataset.type
        fabMenu.classList.add('hidden')
        if (!type) return
        addMode = type
        addBtn.textContent = 'Klick auf Karte, um Trail zu setzen'
        addBtn.classList.add('active')
        mymap.getContainer().classList.add('crosshair-cursor')
      }, { signal })
    }

    // Attach FAB listeners once the map is mounted; auth check happens inside the click handler
    await nextTick()
    attachFabListeners()

    mymap.on('click', async (e: any) => {
      if (!addMode) {
        if (spotPanel.isOpen) spotPanel.close()
        return
      }
      const { giveTrailNearBy } = await import('~/src/near_by_trails')
      const nearby = giveTrailNearBy(e.latlng.lat, e.latlng.lng, trailsStore.all as any)

      const proceed = await new Promise<boolean>(resolve => {
        if (nearby) {
          nearbyConflict.value = { trail: nearby as any, resolve }
        } else {
          resolve(true)
        }
      })

      if (proceed) {
        addSpotPicked.value = { lat: e.latlng.lat, lng: e.latlng.lng, type: addMode }
      }
      addMode = undefined
      const addBtn = document.getElementById('add-btn') as HTMLButtonElement | null
      if (addBtn) {
        addBtn.textContent = '+'
        addBtn.classList.remove('active')
        mymap.getContainer().classList.remove('crosshair-cursor')
      }
    })

    cleanupFn = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      mymap.remove()
    }
  })

  return { openTrail, flyToPlace, nearbyConflict, addSpotPicked }
}
