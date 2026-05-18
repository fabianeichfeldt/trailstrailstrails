import type { Ref } from 'vue'
import type { Trail } from '~/src/types/Trail'
import { markerIconOptions } from '~/src/map/markerIcon'
import {
  DIFF_COLOR,
  computeTrailStats, trailTooltipHtml, placeholderDesc,
  positionTooltip, createTooltipEl,
} from '~/src/map/trailTooltip'
import { fetchMultipleSpotGpx } from '~/src/communication/trails'

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

    // Elevation tooltip — repositioned on GPX polyline hover
    const tooltipEl = createTooltipEl(mymap.getContainer())
    const gpxCache  = new Map<string, { trails: any[]; tours: any[] }>()

    // ── View mode ────────────────────────────────────────────────────────────
    const GPX_ZOOM_THRESHOLD = 11
    let viewMode: 'markers' | 'gpx' = 'markers'
    let gpxLayers: any[] = []
    let renderGen  = 0   // incremented per renderGpxView call; stale renders bail early

    // Cluster + plain layer
    const clusterGroup = new (L as any).MarkerClusterGroup()
    const markerGroup = L.layerGroup()
    mymap.addLayer(clusterGroup)

    function currentLayer() {
      return filtersStore.useCluster ? clusterGroup : markerGroup
    }

    function createCustomIcon(trail: Trail) {
      return L.divIcon(markerIconOptions(trail.type, trail.approved))
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

        marker.on('click', () => {
          mapStore.panelOpen = true
          mymap.flyTo([trail.latitude, trail.longitude], GPX_ZOOM_THRESHOLD, { duration: 1.0 })
          spotPanel.open(trail as any)
        })
      }
    }

    // ── GPX view — shown when zoom >= GPX_ZOOM_THRESHOLD ────────────────────
    async function renderGpxView() {
      const gen = ++renderGen

      // Hide marker layers while in GPX mode
      if (mymap.hasLayer(clusterGroup)) mymap.removeLayer(clusterGroup)
      if (mymap.hasLayer(markerGroup))  mymap.removeLayer(markerGroup)

      // Clear previous GPX layers
      for (const l of gpxLayers) mymap.removeLayer(l)
      gpxLayers = []
      tooltipEl.style.display = 'none'

      // No bounds filter — spot marker coords can be far from the actual trail
      // geometry (e.g. city-centre marker whose trails are 5 km into the hills).
      const all: Trail[] = [...trailsStore.trails, ...trailsStore.bikeparks, ...trailsStore.dirtparks]
      const filtered = filtersStore.apply(all)
      if (!filtered.length) return

      // Batch-fetch GPX for any uncached spots
      const uncached = filtered.filter(t => !gpxCache.has(t.id)).map(t => t.id)
      if (uncached.length) {
        const fetched = await fetchMultipleSpotGpx(uncached)
        fetched.forEach((gpx, id) => gpxCache.set(id, gpx))
      }
      if (gen !== renderGen) return  // a newer render superseded this one

      const containerW = () => mymap.getContainer().clientWidth

      // Tooltip hide is delayed so the mouse can move from the polyline to the
      // tooltip card and click "Spot öffnen" without the card vanishing mid-way.
      let hideTimer: ReturnType<typeof setTimeout> | null = null
      function scheduleHide() {
        if (hideTimer) clearTimeout(hideTimer)
        hideTimer = setTimeout(() => { tooltipEl.style.display = 'none' }, 800)
      }
      function cancelHide() {
        if (hideTimer) clearTimeout(hideTimer)
      }
      tooltipEl.addEventListener('mouseenter', cancelHide)
      tooltipEl.addEventListener('mouseleave', () => { tooltipEl.style.display = 'none' })

      // Double-tap state — shared across all hit lines so consecutive taps on the
      // same trail are detected even if the hit objects differ.
      let lastTapMs   = 0
      let lastTapId   = ''

      function openPanel(trail: Trail) {
        mapStore.panelOpen = true
        spotPanel.open(trail as any)
        tooltipEl.style.display = 'none'
      }

      function showTooltip(
        name: string,
        difficulty: string | null,
        desc: string,
        stats: ReturnType<typeof computeTrailStats>,
        x: number,
        y: number,
        trail: Trail,
      ) {
        tooltipEl.innerHTML = trailTooltipHtml(name, difficulty, desc, stats)
        positionTooltip(tooltipEl, x, y, containerW())
        // Bind the "Spot öffnen" button each time the HTML is refreshed
        tooltipEl.querySelector('.ttr-open')?.addEventListener('click', (e) => {
          e.stopPropagation()
          openPanel(trail)
        }, { once: true })
      }

      function addGpxLine(
        latlngs: [number, number][],
        visibleOpts: any,
        name: string,
        difficulty: string | null,
        points: [number, number, number][],
        trail: Trail,
        trailDesc = '',
      ) {
        // Decorative visible line (non-interactive — events go to hit area)
        const line = L.polyline(latlngs, { ...visibleOpts, interactive: false }).addTo(mymap)

        // Wide nearly-invisible hit area (weight 20, opacity 0.001 keeps it a
        // valid SVG pointer-events target while being visually transparent)
        const hit = L.polyline(latlngs, { weight: 20, opacity: 0.001, color: '#000' }).addTo(mymap)

        const stats = computeTrailStats(points)
        const words = trailDesc ? trailDesc.split(/\s+/) : []
        const desc  = words.length > 150 ? words.slice(0, 150).join(' ') + '…' : trailDesc

        // ── Desktop hover ─────────────────────────────────────────────────────
        hit.on('mouseover', (e: any) => {
          cancelHide()
          showTooltip(name, difficulty, desc, stats, e.containerPoint.x, e.containerPoint.y, trail)
        })
        hit.on('mousemove', (e: any) => positionTooltip(tooltipEl, e.containerPoint.x, e.containerPoint.y, containerW()))
        hit.on('mouseout',  scheduleHide)

        // ── Desktop double-click → open panel ────────────────────────────────
        hit.on('dblclick', (e: any) => {
          L.DomEvent.stop(e)
          openPanel(trail)
        })

        // ── Mobile touch ─────────────────────────────────────────────────────
        let touchHideTimer: ReturnType<typeof setTimeout> | null = null
        hit.on('touchstart', (e: any) => {
          const now = Date.now()
          if (now - lastTapMs < 350 && lastTapId === trail.id) {
            // Double-tap → open panel
            L.DomEvent.stop(e)
            if (touchHideTimer) clearTimeout(touchHideTimer)
            openPanel(trail)
            lastTapMs = 0
            return
          }
          lastTapMs = now
          lastTapId = trail.id

          // Single tap → show tooltip for 3 s
          const touch = e.originalEvent.touches[0]
          const rect  = mymap.getContainer().getBoundingClientRect()
          cancelHide()
          showTooltip(name, difficulty, desc, stats, touch.clientX - rect.left, touch.clientY - rect.top, trail)
          if (touchHideTimer) clearTimeout(touchHideTimer)
          touchHideTimer = setTimeout(() => { tooltipEl.style.display = 'none' }, 3000)
        }, { passive: false })

        gpxLayers.push(line, hit)
      }

      // Fallback layer for spots that have no GPX data — their marker stays
      // visible in GPX view so the spot is never invisible to the user.
      const fallbackLayer = L.layerGroup().addTo(mymap)
      gpxLayers.push(fallbackLayer)

      for (const trail of filtered) {
        const gpx = gpxCache.get(trail.id)
        const hasGpx = gpx && (gpx.trails.length > 0 || gpx.tours.length > 0)

        if (!hasGpx) {
          // Keep the marker for spots without any GPX tracks
          const marker = L.marker([trail.latitude, trail.longitude], {
            icon: createCustomIcon(trail),
          }).addTo(fallbackLayer)
          marker.on('click', () => {
            mapStore.panelOpen = true
            spotPanel.open(trail as any)
          })
          continue
        }

        // Tours first → lower z-order; trails second → win when stacked
        for (const t of gpx.tours) {
          const latlngs = t.gpx_points.map(([la, ln]: [number, number, number]) => [la, ln] as [number, number])
          addGpxLine(latlngs, { color: '#555', weight: 3, opacity: 0.6, dashArray: '8, 6' }, t.name, null, t.gpx_points, trail)
        }
        for (const t of gpx.trails) {
          const latlngs = t.gpx_points.map(([la, ln]: [number, number, number]) => [la, ln] as [number, number])
          addGpxLine(latlngs, { color: DIFF_COLOR[t.difficulty] ?? '#888', weight: 4, opacity: 0.85 }, t.name, t.difficulty, t.gpx_points, trail, t.trail_description ?? '')
        }
      }
    }

    function switchView() {
      if (mymap.getZoom() >= GPX_ZOOM_THRESHOLD) {
        viewMode = 'gpx'
        renderGpxView()
      } else {
        viewMode = 'markers'
        // Remove GPX layers and restore marker layers
        for (const l of gpxLayers) mymap.removeLayer(l)
        gpxLayers = []
        tooltipEl.style.display = 'none'
        renderMarkers()
      }
    }

    // Expose trail open + fly-to for search bar
    openTrailFn.value = (id: string) => {
      const trail = trailsStore.all.find(t => t.id === id)
      if (!trail) return
      mapStore.panelOpen = true
      mymap.flyTo([trail.latitude, trail.longitude], GPX_ZOOM_THRESHOLD, { duration: 1.2 })
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

    // Load data and do initial render
    await trailsStore.fetchAll()
    switchView()

    // React to filter / data changes in whichever view is active
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
      () => { if (viewMode === 'markers') renderMarkers(); else renderGpxView() },
    )

    // Switch between marker / GPX view on zoom change
    mymap.on('zoomend', switchView)
    // Re-render GPX for newly visible spots after panning (markers self-manage via layer group)
    mymap.on('moveend', () => { if (viewMode === 'gpx') renderGpxView() })

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
