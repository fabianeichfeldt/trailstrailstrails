import type { Ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import type { Trail } from '~/types/Trail'
import { markerIconOptions, parkingIconOptions, trailStatusBadgeOptions } from '~/map/markerIcon'
import {
  DIFF_COLOR,
  computeTrailStats, trailTooltipHtml, placeholderDesc,
  positionTooltip, createTooltipEl,
} from '~/map/trailTooltip'
import { GpxRenderGuard } from '~/map/gpxRenderGuard'
import { GPX_ZOOM_THRESHOLD } from '~/map/gpxZoomThreshold'
import { fetchMultipleSpotGpx, fetchMultipleSpotParking, type SpotParkingLot } from '~/communication/trails'
import { deriveTrailStatus, type TrailStatusResult } from '~/types/TrailStatus'
import { isDesktopViewport } from '~/utils/viewport'
import { createTrailStatusSheet, buildTrailStatusContent } from '~/map/trailStatusSheet'
import { registerBackHandler } from '~/utils/nativeBack'

// Zoom level used when flying to a single spot (search result, `?trail=`
// query param) — matches the level used for the same purpose in the
// embedded map on app/pages/trails/[slug].vue.
const FLY_TO_TRAIL_ZOOM = 14

export function useTrailMap(mapEl: Ref<HTMLElement | null>) {
  const trailsStore = useTrailsStore()
  const filtersStore = useFiltersStore()
  const mapStore = useMapStore()
  const router = useRouter()

  // Exposed for search bar
  const mapInstance = shallowRef<any>(null)
  const openTrailFn = ref<((id: string) => void) | null>(null)
  const flyToFn = ref<((lat: number, lon: number) => void) | null>(null)
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

  // Emitted when user picks a location in add mode
  const addSpotPicked = ref<{ lat: number; lng: number; type: string } | null>(null)

  function openTrail(id: string) { openTrailFn.value?.(id) }
  function flyToPlace(lat: number, lon: number) { flyToFn.value?.(lat, lon) }

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
  async function navigateToSpot(id: string, hash = '') {
    await router.replace({ path: '/map', query: { trail: id } })
    router.push(`/trails/${id}${hash}`)
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
    const gpxCache  = new Map<string, { trails: any[]; tours: any[] }>()
    // Trail status badge — mobile explanation sheet, singleton reused across taps
    const statusSheet = createTrailStatusSheet()
    // Parking lots per spot — same cache/staleness pattern as gpxCache, fetched
    // and rendered alongside the GPX overview (same zoom-triggered path).
    const parkingCache = new Map<string, SpotParkingLot[]>()

    // ── View mode ────────────────────────────────────────────────────────────
    const renderGuard = new GpxRenderGuard()
    let gpxLayers: any[] = []
    // Plain marker layers for parking lots — not clustered, mirrors gpxLayers
    let parkingLayers: any[] = []
    // Visible line layers grouped by spot ID for hover highlighting
    let gpxSpotLines = new Map<string, Array<{ line: L.Polyline; opts: any }>>()

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

    function renderMarkers() {
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
          navigateToSpot(trail.id)
        })
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
      gpxSpotLines = new Map()
      // Clear previous parking markers
      for (const l of parkingLayers) mymap.removeLayer(l)
      parkingLayers = []
      tooltipEl.style.display = 'none'

      // No bounds filter — spot marker coords can be far from the actual trail
      // geometry (e.g. city-centre marker whose trails are 5 km into the hills).
      const all: Trail[] = [...trailsStore.trails, ...trailsStore.bikeparks, ...trailsStore.dirtparks]
      const filtered = filtersStore.apply(all)
      if (!filtered.length) return

      // Batch-fetch GPX + parking lots for any uncached spots
      const uncached = filtered.filter(t => !gpxCache.has(t.id)).map(t => t.id)
      const uncachedParking = filtered.filter(t => !parkingCache.has(t.id)).map(t => t.id)
      const [fetched, fetchedParking] = await Promise.all([
        uncached.length ? fetchMultipleSpotGpx(uncached) : Promise.resolve(new Map()),
        uncachedParking.length ? fetchMultipleSpotParking(uncachedParking) : Promise.resolve(new Map()),
      ])
      fetched.forEach((gpx: any, id: string) => gpxCache.set(id, gpx))
      fetchedParking.forEach((lots: SpotParkingLot[], id: string) => parkingCache.set(id, lots))
      if (renderGuard.isStale(gen)) return  // superseded by newer render or mode switched to markers

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
        tooltipEl.style.display = 'none'
        navigateToSpot(trail.id)
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

      function highlightLine(target: L.Polyline) {
        gpxSpotLines.forEach(entries => {
          for (const { line, opts } of entries) {
            if (line === target) {
              line.setStyle({ weight: (opts.weight ?? 4) + 2, opacity: 1 })
              line.bringToFront()
            } else {
              line.setStyle({ weight: (opts.weight ?? 4) - 1, opacity: 0.3 })
            }
          }
        })
      }

      function resetSpotHighlights() {
        gpxSpotLines.forEach(entries => {
          for (const { line, opts } of entries) {
            line.setStyle({ weight: opts.weight, opacity: opts.opacity })
          }
        })
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

        // Register for hover highlighting (flat list per spot for reset)
        const spotEntry = gpxSpotLines.get(trail.id) ?? []
        spotEntry.push({ line, opts: visibleOpts })
        gpxSpotLines.set(trail.id, spotEntry)

        // Wide nearly-invisible hit area (weight 20, opacity 0.001 keeps it a
        // valid SVG pointer-events target while being visually transparent)
        const hit = L.polyline(latlngs, { weight: 20, opacity: 0.001, color: '#000' }).addTo(mymap)

        const stats = computeTrailStats(points)
        const words = trailDesc ? trailDesc.split(/\s+/) : []
        const desc  = words.length > 150 ? words.slice(0, 150).join(' ') + '…' : trailDesc

        // ── Desktop hover ─────────────────────────────────────────────────────
        hit.on('mouseover', (e: any) => {
          highlightLine(line)
          cancelHide()
          showTooltip(name, difficulty, desc, stats, e.containerPoint.x, e.containerPoint.y, trail)
        })
        hit.on('mousemove', (e: any) => positionTooltip(tooltipEl, e.containerPoint.x, e.containerPoint.y, containerW()))
        hit.on('mouseout', () => {
          resetSpotHighlights()
          scheduleHide()
        })

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
            resetSpotHighlights()
            openPanel(trail)
            lastTapMs = 0
            return
          }
          lastTapMs = now
          lastTapId = trail.id

          // Single tap → show tooltip for 3 s, highlight trail
          highlightLine(line)
          const touch = e.originalEvent.touches[0]
          const rect  = mymap.getContainer().getBoundingClientRect()
          cancelHide()
          showTooltip(name, difficulty, desc, stats, touch.clientX - rect.left, touch.clientY - rect.top, trail)
          if (touchHideTimer) clearTimeout(touchHideTimer)
          touchHideTimer = setTimeout(() => {
            tooltipEl.style.display = 'none'
            resetSpotHighlights()
          }, 3000)
        }, { passive: false })

        gpxLayers.push(line, hit)
      }

      // ── Trail status badge — additive marker at the track's midpoint,
      // shown only for 'closing_soon' / 'closed' (never for 'open'). The
      // difficulty-color line rendering in addGpxLine() above is untouched.
      function addStatusBadge(
        latlngs: [number, number][],
        status: TrailStatusResult & { state: 'closing_soon' | 'closed' },
        spotName: string,
      ) {
        if (!latlngs.length) return
        const mid = latlngs[Math.floor(latlngs.length / 2)]

        const marker = L.marker(mid, {
          icon: L.divIcon(trailStatusBadgeOptions(status.state)),
          zIndexOffset: 1000,
        }).addTo(mymap)

        marker.on('click', (e: any) => {
          L.DomEvent.stop(e)
          if (isDesktopViewport()) {
            marker.bindPopup(buildTrailStatusContent(status, spotName)).openPopup()
          } else {
            statusSheet.open(status, spotName)
          }
        })

        gpxLayers.push(marker)
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
            navigateToSpot(trail.id)
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

          const status = deriveTrailStatus(
            { closed_from: t.closed_from, closed_to: t.closed_to, hint: t.hint },
            new Date(),
          )
          if (status.state !== 'open') {
            addStatusBadge(latlngs, status as TrailStatusResult & { state: 'closing_soon' | 'closed' }, trail.name)
          }
        }
      }

      // Parking markers — plain layers added directly to the map (not
      // clustered), shown alongside the GPX overview for every spot type.
      for (const trail of filtered) {
        const lots = parkingCache.get(trail.id) ?? []
        for (const lot of lots) {
          const marker = L.marker([lot.lat, lot.lng], {
            icon: L.divIcon(parkingIconOptions()),
          }).addTo(mymap)
          marker.on('click', () => {
            // No deep-linking to a specific lot selection (YAGNI per the
            // spot-detail-real-pages spec) — jump straight to the spot
            // page's Parkplätze section instead of highlighting one lot.
            navigateToSpot(trail.id, '#parking')
          })
          parkingLayers.push(marker)
        }
      }
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
        gpxSpotLines = new Map()
        // Remove parking markers — they only show alongside the GPX overview
        for (const l of parkingLayers) mymap.removeLayer(l)
        parkingLayers = []
        tooltipEl.style.display = 'none'
        statusSheet.close()
        renderMarkers()
      }
    }

    // Expose trail open + fly-to for search bar. "Open" a trail from search
    // or the `?trail=` query param (news-card links, etc.) now only flies
    // the live map to its coordinates and zooms in — it stays on /map,
    // matching the marker-click behavior of not auto-navigating away.
    // Only an actual click on the spot's own marker (see the `marker.on
    // ('click', ...)` handlers above) opens its detail page.
    openTrailFn.value = (id: string) => {
      const trail = trailsStore.all.find(t => t.id === id)
      if (!trail) return
      mymap.flyTo([trail.latitude, trail.longitude], FLY_TO_TRAIL_ZOOM, { duration: 1.2 })
    }
    flyToFn.value = (lat, lon) => mymap.flyTo([lat, lon], 11, { duration: 1.2 })

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

    function cancelAddMode() {
      addMode = undefined
      const addBtn = document.getElementById('add-btn') as HTMLButtonElement | null
      if (addBtn) {
        addBtn.textContent = '+'
        addBtn.classList.remove('active')
      }
      mymap.getContainer().classList.remove('crosshair-cursor')
    }

    // Attach FAB listeners once the map is mounted; auth check happens inside the click handler
    await nextTick()
    attachFabListeners()

    mymap.on('click', async (e: any) => {
      if (!addMode) {
        if (statusSheet.isOpen) statusSheet.close()
        return
      }
      const { giveTrailNearBy } = await import('~/utils/near_by_trails')
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
        if (addMode) { cancelAddMode(); return true }
        return false
      })
    }

    cleanupFn = () => {
      renderGuard.destroy()
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      unregisterBackHandler?.()
      mymap.remove()
    }
  })

  return { openTrail, flyToPlace, nearbyConflict, addSpotPicked, mapReady }
}
