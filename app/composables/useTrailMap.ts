import { track } from '~/analytics/track'
import type { Ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import type { Trail } from '~/types/Trail'
import { markerIconOptions, parkingIconOptions, trailStatusBadgeOptions } from '~/map/markerIcon'
import { clusterDonutHtml } from '~/map/soilBadge'
import { createSoilRadarLayer, type SoilRadarLayer } from '~/map/soilRadarLayer'
import {
  markerPins, pinGhost, pinIconOptions, clusterLevels, soilChips, radarPoints, soilCountsInView,
  type PinView, type ViewBounds,
} from '~/map/markerPresentation'
import { createTooltipEl } from '~/map/trailTooltip'
import {
  addTrackLayer, createHideController, bindTooltipHover, createTapDetector, createLineHighlighter,
} from '~/map/gpxLayer'
import { gpxOverview, uncachedIds, clusterSize, type GpxCacheEntry } from '~/map/gpxOverview'
import { resolveAddClick } from '~/map/addSpotClick'
import { GpxRenderGuard } from '~/map/gpxRenderGuard'
import { GPX_ZOOM_THRESHOLD } from '~/map/gpxZoomThreshold'
import { fetchMultipleSpotGpx, fetchMultipleSpotParking, type SpotParkingLot } from '~/communication/trails'
import { isDesktopViewport } from '~/utils/viewport'
import { createTrailStatusSheet, buildTrailStatusContent } from '~/map/trailStatusSheet'
import { registerBackHandler } from '~/utils/nativeBack'
import { createMapFlyers } from '~/map/flyHandlers'

export function useTrailMap(mapEl: Ref<HTMLElement | null>) {
  const trailsStore = useTrailsStore()
  const filtersStore = useFiltersStore()
  const mapStore = useMapStore()
  const soilStore = useSoilRadarStore()
  const router = useRouter()

  // Exposed for search bar
  const mapInstance = shallowRef<any>(null)
  const openTrailFn = ref<((id: string) => void) | null>(null)
  const flyToFn = ref<((lat: number, lon: number, zoom?: number) => void) | null>(null)
  // True once openTrailFn/flyToFn are actually callable — MapView.vue emits
  // 'ready' off this instead of its own onMounted, which otherwise fires
  // before the awaited leaflet imports/setup below reach the assignments
  // further down. On a first-ever page load that race is invisible (the
  // `?trail=` handler in app/pages/map.vue falls back to watching
  // trailsStore.all, which only populates well after these are assigned),
  // but on any later navigation back to /map — trailsStore.all is a Pinia
  // store and stays populated across route changes — that handler takes
  // its immediate-call branch instead, right as 'ready' fires, and would
  // silently call a still-null openTrailFn.
  const mapReady = ref(false)
  // Boden-Radar counter chip: spots in the viewport matching the range / all with data.
  const soilCounts = ref({ matchCount: 0, totalCount: 0 })
  const getCenterFn = ref<(() => { lat: number; lon: number } | null) | null>(null)

  // Marker clicks do a real router.push instead of opening a panel on top
  // of the still-live map (spot-detail-real-pages rework), so this
  // composable can unmount mid-way through its own async setup — even
  // before `cleanupFn` below has been assigned (e.g. a marker is clicked
  // before the dynamic `import('leaflet')` resolves). Set directly in
  // onUnmounted(), not only inside cleanupFn, so it's still true for that
  // early-unmount case. Checked after every `await` inside onMounted()
  // below so a resumed continuation never touches a Leaflet map that's
  // already been torn down (or never even creates one).
  let destroyed = false
  // Cleanup registered synchronously — can't call onUnmounted after await
  let cleanupFn: (() => void) | null = null
  onUnmounted(() => {
    destroyed = true
    cleanupFn?.()
  })

  // Nearby conflict state (replaces DOM-based modal)
  const nearbyConflict = ref<{
    trail: Trail
    resolve: (proceed: boolean) => void
  } | null>(null)

  // Armed add-spot type (FAB); the FAB markup itself lives in pages/map.vue.
  const addMode = ref<string | undefined>(undefined)
  const startAddMode = (type: string) => { addMode.value = type }
  const cancelAddMode = () => { addMode.value = undefined }
  watch(addMode, (v) => { mapEl.value?.classList.toggle('crosshair-cursor', !!v) })

  // Emitted when user picks a location in add mode
  const addSpotPicked = ref<{ lat: number; lng: number; type: string } | null>(null)

  function openTrail(id: string) { openTrailFn.value?.(id) }
  function flyToPlace(lat: number, lon: number, zoom?: number) { flyToFn.value?.(lat, lon, zoom) }

  // Every "open this spot" click on the map (marker, GPX line/tooltip,
  // parking pin) navigates away to /trails/[id] — so browser back would
  // otherwise land on a bare /map, losing the spot the user was just
  // looking at. router.push() always rewrites the *current* history entry
  // from vue-router's own remembered URL before pushing the new one (see
  // useHistoryStateNavigation in vue-router's html5 history: push() calls
  // changeLocation(currentState.current, ...) first) — so a raw
  // history.replaceState() here gets silently clobbered back to plain
  // /map the moment push() runs. Awaiting router.replace() first updates
  // vue-router's own bookkeeping (not just the visible URL), so the
  // subsequent push() preserves /map?trail=id as the entry browser back
  // returns to. Same route/component, query-only change, so this doesn't
  // remount /map or re-run its one-time onMapReady() flyTo logic.
  async function navigateToSpot(trail: Trail, hash = '') {
    track('map_pin_open', { type: trail.type })
    // ?trail= stays the spot id (map deep-link, resolved by openTrailFn); the
    // detail page path is the name-slug.
    await router.replace({ path: '/map', query: { trail: trail.id } })
    router.push(`/trails/${trail.slug}${hash}`)
  }

  onMounted(async () => {
    if (!mapEl.value) return

    // Dynamic imports — all Leaflet code runs client-only
    const L = (await import('leaflet')).default
    await import('leaflet.markercluster')
    if (destroyed) return

    const mymap = L.map(mapEl.value, {
      zoomControl: false,
    })

    mapInstance.value = mymap
    mymap.setMaxZoom(19)

    //L.tileLayer('https://tile.tracestrack.com/topo__/{z}/{x}/{y}.webp?key=4380ddf8c7e3d985c0835d43bb748130&style=contrast-', {
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mymap)

    L.control.zoom({ position: 'bottomright' }).addTo(mymap)

    // Elevation tooltip — repositioned on GPX polyline hover
    const tooltipEl = createTooltipEl(mymap.getContainer())
    const gpxCache  = new Map<string, GpxCacheEntry>()
    // Trail status badge — mobile explanation sheet, singleton reused across taps
    const statusSheet = createTrailStatusSheet()
    // Parking lots per spot — same cache/staleness pattern as gpxCache, fetched
    // and rendered alongside the GPX overview (same zoom-triggered path).
    const parkingCache = new Map<string, SpotParkingLot[]>()
    // Tooltip hide is delayed so the mouse can move from the polyline to the card and click "Spot öffnen".
    const hide = createHideController(tooltipEl)
    bindTooltipHover(tooltipEl, hide)
    const tapDetector = createTapDetector(350)

    // ── View mode ────────────────────────────────────────────────────────────
    const renderGuard = new GpxRenderGuard()
    let gpxLayers: any[] = []
    // Plain marker layers for parking lots — not clustered, mirrors gpxLayers
    let parkingLayers: any[] = []
    // Visible line layers grouped by spot ID for hover highlighting
    const highlighter = createLineHighlighter()

    // Cluster + plain layer — what each pin shows comes from ~/map/markerPresentation.
    const allSpots = (): Trail[] => [...trailsStore.trails, ...trailsStore.bikeparks, ...trailsStore.dirtparks]
    const viewBounds = (): ViewBounds => {
      const b = mymap.getBounds()
      return { south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() }
    }

    // Mirrors leaflet.markercluster's default icon so only the radar changes the look.
    function defaultClusterIcon(cluster: any) {
      const n = cluster.getChildCount()
      const size = clusterSize(n)
      return new (L as any).DivIcon({
        html: `<div><span>${n}</span></div>`,
        className: `marker-cluster marker-cluster-${size}`,
        iconSize: new (L as any).Point(40, 40),
      })
    }

    const markerPin = new Map<any, PinView>()

    const clusterGroup = new (L as any).MarkerClusterGroup({
      iconCreateFunction: (cluster: any) => {
        const levels = clusterLevels(cluster.getAllChildMarkers().map((m: any) => markerPin.get(m)), soilStore.enabled)
        if (!levels) return defaultClusterIcon(cluster)
        return (L as any).divIcon({ html: clusterDonutHtml(levels), className: 'soil-cluster', iconSize: [42, 42] })
      },
    })
    const markerGroup = L.layerGroup()
    mymap.addLayer(clusterGroup)

    function currentLayer() {
      return filtersStore.useCluster ? clusterGroup : markerGroup
    }

    // GPX-view fallback pin: plain, because the soil chip already carries the verdict there.
    function createCustomIcon(trail: Trail) {
      return L.divIcon(markerIconOptions(trail.type, trail.approved))
    }

    let soilLayer: SoilRadarLayer | null = null

    function updateSoilCounts() {
      if (destroyed) return
      soilCounts.value = soilCountsInView(soilStore, viewBounds())
    }

    // Slider drag: only pins whose ghost state flipped get a new icon (no pop replay, no full re-render).
    function refreshGhosts() {
      for (const [marker, pin] of markerPin) {
        const ghost = pinGhost(pin.level, soilStore.range)
        if (ghost === pin.ghost) continue
        const next = { ...pin, ghost, delayMs: undefined }
        markerPin.set(marker, next)
        marker.setIcon(L.divIcon(pinIconOptions(next)))
      }
    }

    function renderMarkers(introDelays = false) {
      // Guards the same teardown race as GpxRenderGuard.destroy() (see its
      // comment), for the one Leaflet-touching entry point that isn't
      // gated by that guard: the trailsStore/filtersStore watch() below
      // can still fire after this composable unmounts (Vue doesn't
      // reliably tie a watcher created after an `await` inside onMounted
      // to the component's effect scope), calling straight into here with
      // no async gap of its own to check `destroyed` at.
      if (destroyed) return
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
      markerPin.clear()

      // Angle-based pop delays only for the intro render, or badges would re-pop on every re-render.
      const c = introDelays ? mymap.getCenter() : null
      for (const pin of markerPins(filtersStore.apply(allSpots()), soilStore, c && { lat: c.lat, lon: c.lng })) {
        const trail = pin.trail
        const marker = L.marker([pin.lat, pin.lon], {
          icon: L.divIcon(pinIconOptions(pin)),
          ...(trail ? {} : { interactive: false, keyboard: false }),
        })
        // Registered before addTo: the cluster icon callback reads it while adding.
        markerPin.set(marker, pin)
        marker.addTo(currentLayer() as any)
        if (trail) marker.on('click', () => { navigateToSpot(trail) })
      }
    }

    // GPX view (zoom >= threshold): one soil chip per spot in view, at its coordinates.
    let chipLayers: any[] = []
    function clearSoilChips() {
      for (const m of chipLayers) mymap.removeLayer(m)
      chipLayers = []
    }
    function renderSoilChips() {
      clearSoilChips()
      if (destroyed || renderGuard.viewMode !== 'gpx') return
      for (const chip of soilChips(filtersStore.apply(allSpots()), soilStore, viewBounds())) {
        chipLayers.push(L.marker([chip.lat, chip.lon], {
          icon: L.divIcon(chip.icon), interactive: false, keyboard: false,
        }).addTo(mymap))
      }
    }

    // ── GPX view — shown when zoom >= GPX_ZOOM_THRESHOLD ────────────────────
    async function renderGpxView() {
      if (destroyed) return
      const gen = renderGuard.beginRender()

      // Hide marker layers while in GPX mode
      if (mymap.hasLayer(clusterGroup)) mymap.removeLayer(clusterGroup)
      if (mymap.hasLayer(markerGroup))  mymap.removeLayer(markerGroup)

      // Clear previous GPX layers
      for (const l of gpxLayers) mymap.removeLayer(l)
      gpxLayers = []
      highlighter.clear()
      // Clear previous parking markers
      for (const l of parkingLayers) mymap.removeLayer(l)
      parkingLayers = []
      tooltipEl.style.display = 'none'

      // No bounds filter — spot marker coords can be far from the actual trail
      // geometry (e.g. city-centre marker whose trails are 5 km into the hills).
      const filtered = filtersStore.apply(allSpots())
      if (!filtered.length) return

      // Batch-fetch GPX + parking lots for any uncached spots
      const uncached = uncachedIds(filtered, gpxCache)
      const uncachedParking = uncachedIds(filtered, parkingCache)
      const [fetched, fetchedParking] = await Promise.all([
        uncached.length ? fetchMultipleSpotGpx(uncached) : Promise.resolve(new Map()),
        uncachedParking.length ? fetchMultipleSpotParking(uncachedParking) : Promise.resolve(new Map()),
      ])
      fetched.forEach((gpx: any, id: string) => gpxCache.set(id, gpx))
      fetchedParking.forEach((lots: SpotParkingLot[], id: string) => parkingCache.set(id, lots))
      if (renderGuard.isStale(gen)) return  // superseded by newer render or mode switched to markers

      const view = gpxOverview(filtered, gpxCache, parkingCache, new Date())

      function openPanel(trail: Trail) {
        tooltipEl.style.display = 'none'
        navigateToSpot(trail)
      }

      // Every spot keeps its pin in GPX view — it marks the spot centre, tracks or not.
      const spotPinLayer = L.layerGroup().addTo(mymap)
      gpxLayers.push(spotPinLayer)
      for (const trail of view.pins) {
        L.marker([trail.latitude, trail.longitude], { icon: createCustomIcon(trail) })
          .addTo(spotPinLayer)
          .on('click', () => { navigateToSpot(trail) })
      }

      for (const ln of view.lines) {
        const { line, hit } = addTrackLayer({
          L, map: mymap, parent: mymap, tooltipEl, hide, highlighter,
          latlngs: ln.latlngs, visibleOpts: ln.style, name: ln.name, difficulty: ln.difficulty,
          points: ln.points, description: ln.description, spotId: ln.spot.id,
          onOpen: () => openPanel(ln.spot),
          doubleTap: { detector: tapDetector, id: ln.spot.id },
        })
        gpxLayers.push(line, hit)
      }

      // Status badge at the track midpoint; the difficulty-colour lines stay untouched.
      for (const b of view.badges) {
        const marker = L.marker(b.latlng, {
          icon: L.divIcon(trailStatusBadgeOptions(b.status.state)),
          zIndexOffset: 1000,
        }).addTo(mymap)
        marker.on('click', (e: any) => {
          L.DomEvent.stop(e)
          if (isDesktopViewport()) {
            marker.bindPopup(buildTrailStatusContent(b.status, b.spot.name)).openPopup()
          } else {
            statusSheet.open(b.status, b.spot.name)
          }
        })
        gpxLayers.push(marker)
      }

      // Parking pins: plain layers on the map (not clustered), for every spot type.
      for (const p of view.parking) {
        const marker = L.marker([p.lat, p.lng], { icon: L.divIcon(parkingIconOptions()) }).addTo(mymap)
        // No per-lot deep link (YAGNI) — jump to the spot page's Parkplätze section.
        marker.on('click', () => { navigateToSpot(p.spot, '#parking') })
        parkingLayers.push(marker)
      }
      renderSoilChips()
    }

    function switchView() {
      if (mymap.getZoom() >= GPX_ZOOM_THRESHOLD) {
        renderGuard.enterGpxMode()
        renderGpxView()
      } else {
        renderGuard.enterMarkerMode()
        // Remove GPX layers and restore marker layers
        for (const l of gpxLayers) mymap.removeLayer(l)
        gpxLayers = []
        highlighter.clear()
        // Remove parking markers — they only show alongside the GPX overview
        for (const l of parkingLayers) mymap.removeLayer(l)
        parkingLayers = []
        tooltipEl.style.display = 'none'
        statusSheet.close()
        clearSoilChips()
        renderMarkers()
      }
    }

    // Expose trail open + fly-to for search bar. "Open" a trail from search
    // or the `?trail=` query param (news-card links, etc.) now only flies
    // the live map to its coordinates and zooms in — it stays on /map,
    // matching the marker-click behavior of not auto-navigating away.
    // Only an actual click on the spot's own marker (see the `marker.on
    // ('click', ...)` handlers above) opens its detail page.
    const flyers = createMapFlyers(mymap, id => trailsStore.all.find(t => t.id === id))
    openTrailFn.value = flyers.openTrail
    flyToFn.value = flyers.flyToPlace

    // Initial location
    const { getApproxLocation } = await import('~/communication/location')
    const loc = await getApproxLocation()
    if (destroyed) return
    if (loc.lat !== 0 || loc.lng !== 0) {
      mymap.setView([loc.lat, loc.lng], 9)
    } else {
      mymap.setView([51.163, 10.447], 6)
    }
    // Only now is the map's own flyTo()/getCenter() safe to call (Leaflet
    // throws "Set map center and zoom first" otherwise) — mapReady must
    // wait for setView() above, not just for openTrailFn/flyToFn to exist.
    mapReady.value = true

    // Load data and do initial render
    await trailsStore.fetchAll()
    if (destroyed) return
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
      () => { if (renderGuard.viewMode === 'markers') renderMarkers(); else renderGpxView() },
    )

    // Switch between marker / GPX view on zoom change
    mymap.on('zoomend', switchView)
    // Re-render GPX for newly visible spots after panning (markers self-manage via layer group)
    mymap.on('moveend', () => { if (renderGuard.viewMode === 'gpx') renderGpxView() })

    // ── Boden-Radar wiring ───────────────────────────────────────────────────
    soilLayer = createSoilRadarLayer(mymap, L)
    // A restored `enabled` (reload) shows without the intro; only a fresh enable plays it.
    let wasOn = soilStore.enabled
    const rerender = (intro = false) => {
      if (renderGuard.viewMode === 'markers') renderMarkers(intro)
      else renderSoilChips()
    }
    function syncSoil() {
      if (destroyed || !soilLayer) return
      const on = soilStore.enabled
      const turningOn = on && !wasOn
      wasOn = on
      soilLayer.setPoints(radarPoints(soilStore))
      soilLayer.setVisible(on)
      rerender(turningOn && soilStore.points.length > 0)
      updateSoilCounts()
      if (turningOn && soilStore.points.length > 0) void soilLayer.playIntro()
    }
    const stopSoil = [
      // Data arrives after a restored `enabled`, or the mode/enabled flag flips.
      watch(() => [soilStore.enabled, soilStore.mode, soilStore.points] as const, syncSoil),
      // Slider: clouds redraw, only flipped pins re-icon; no marker re-render.
      watch(() => soilStore.range, () => {
        soilLayer?.setPoints(radarPoints(soilStore))
        refreshGhosts()
        if (renderGuard.viewMode === 'gpx') renderSoilChips()
        updateSoilCounts()
      }, { deep: true }),
    ]
    mymap.on('moveend', updateSoilCounts)
    getCenterFn.value = () => { const c = mymap.getCenter(); return { lat: c.lat, lon: c.lng } }
    if (soilStore.enabled) syncSoil()

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

    // Map click: place a spot in add mode, otherwise dismiss the status sheet.
    mymap.on('click', async (e: any) => {
      if (!addMode.value) {
        if (statusSheet.isOpen) statusSheet.close()
        return
      }
      const { giveTrailNearBy } = await import('~/utils/near_by_trails')
      const pick = await resolveAddClick({
        mode: addMode.value,
        latlng: e.latlng,
        findNearby: (lat, lng) => giveTrailNearBy(lat, lng, trailsStore.all as any) as Trail | null,
        askConflict: nearby => new Promise<boolean>(resolve => { nearbyConflict.value = { trail: nearby, resolve } }),
      })
      if (pick) addSpotPicked.value = pick
      cancelAddMode()
    })

    // Android hardware/gesture back: dismiss whatever's on top of the map
    // before the global listener (plugins/capacitor.client.ts — it has to
    // live outside this composable since it must also handle back on pages,
    // like root, that never mount a map at all) falls through to router
    // history or app exit.
    let unregisterBackHandler: (() => void) | null = null
    if (Capacitor.isNativePlatform()) {
      unregisterBackHandler = registerBackHandler(() => {
        if (statusSheet.isOpen) { statusSheet.close(); return true }
        if (addMode.value) { cancelAddMode(); return true }
        return false
      })
    }

    cleanupFn = () => {
      renderGuard.destroy()
      stopSoil.forEach(stop => stop())
      soilLayer?.destroy()
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      unregisterBackHandler?.()
      mymap.remove()
    }
  })

  return { openTrail, flyToPlace, nearbyConflict, addSpotPicked, addMode, startAddMode, cancelAddMode, mapReady, soilCounts, getCenter: () => getCenterFn.value?.() ?? null }
}
