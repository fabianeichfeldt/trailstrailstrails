// Read-only Leaflet mini-map renderer, shared by the spot-detail page
// (app/components/trail_detail/SpotDetailMiniMap.vue) and the third-party
// embed page (app/pages/embed/[token].vue).
//
// Layer rules (see app/architecture.test.ts + .dependency-cruiser.cjs):
// this module may be imported by pages/, components/ and composables/, and
// it owns a Leaflet instance — but it must NOT import from stores/ or
// composables/. Callers wire store/state in themselves (e.g. the spot page
// passes an onPolylineActivate that calls spotPanelStore.selectItem).
//
// leaflet + leaflet-gesture-handling are dynamically imported inside
// createMiniMap so they never land in the entry bundle — only in whichever
// route chunk actually renders a mini-map.
import { markerIconOptions, parkingIconOptions } from './markerIcon'
import {
  DIFF_COLOR,
  computeTrailStats, trailTooltipHtml, placeholderDesc,
  positionTooltip, createTooltipEl,
} from './trailTooltip'
import { shouldShowGpx } from './gpxZoomThreshold'

/** One trail or tour track to draw. */
export interface MiniMapPolyline {
  id: string
  kind: 'trail' | 'tour'
  name: string
  difficulty: string | null          // ImbaColor | null (null === tour)
  points: [number, number, number][] // [lat, lng, alt]
}

/** A point marker: the spot itself, or a parking lot. */
export interface MiniMapMarker {
  lat: number
  lng: number
  kind: 'spot' | 'parking'
  spotType?: string                  // markerIconOptions() category, when kind === 'spot'
  approved?: boolean
  name?: string
  popupHtml?: string
}

export interface MiniMapInput {
  center: [number, number]
  zoom: number
  polylines: MiniMapPolyline[]
  markers: MiniMapMarker[]
}

export interface MiniMapOptions {
  interactive: boolean
  /**
   * Called when a polyline is clicked/tapped. Inline map → selectItem();
   * embed page → open the trail page in a new tab.
   */
  onPolylineActivate?: (p: MiniMapPolyline) => void
  /** Optional extra HTML for the hover/touch tooltip's action row. */
  tooltipActionHtml?: (p: MiniMapPolyline) => string | null
  /** Wire clicks on `.ttr-open` inside the tooltip. Falls back to onPolylineActivate. */
  onTooltipAction?: (p: MiniMapPolyline) => void
  /** Force the marker-vs-GPX decision instead of using shouldShowGpx(). */
  showGpxAtZoom?: boolean
}

export interface MiniMapHandle {
  flyTo(lat: number, lng: number, zoom?: number): void
  /** Re-render polylines/markers without re-initialising the map. */
  setData(input: MiniMapInput): void
  destroy(): void
}

/**
 * Tours first, then trails — tour SVG elements sit below trails, and the
 * trail hit-areas end up on top when the two overlap.
 */
export function orderPolylines(polylines: MiniMapPolyline[]): MiniMapPolyline[] {
  return [
    ...polylines.filter(p => p.kind === 'tour'),
    ...polylines.filter(p => p.kind === 'trail'),
  ]
}

/**
 * Whether GPX tracks (vs. the spot marker) should render for this input.
 * A `showGpxAtZoom` override wins; otherwise the shared zoom threshold gate
 * decides, keyed off whether there are any polylines at all.
 */
export function resolveShowGpx(input: MiniMapInput, options: MiniMapOptions): boolean {
  if (typeof options.showGpxAtZoom === 'boolean') return options.showGpxAtZoom
  return shouldShowGpx(input.polylines.length > 0, input.zoom)
}

export async function createMiniMap(
  el: HTMLElement,
  input: MiniMapInput,
  options: MiniMapOptions,
): Promise<MiniMapHandle> {
  const { interactive } = options
  const L = (await import('leaflet')).default
  // Registers L.Map's "gestureHandling" option (side effect on L.Map).
  await import('leaflet-gesture-handling')

  const map = L.map(el, {
    zoomControl: interactive,
    dragging: interactive,
    scrollWheelZoom: interactive,
    doubleClickZoom: interactive,
    touchZoom: interactive,
    boxZoom: interactive,
    keyboard: interactive,
    // Requires ctrl/cmd+scroll to zoom and two fingers to pan on touch when
    // interactive, so a stray wheel-scroll / one-finger drag over the map
    // inside a normally-scrolling page doesn't hijack the page.
    gestureHandling: interactive,
  } as any)
  map.setView(input.center, input.zoom)
  map.setMaxZoom(19)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)

  // ── Hover / touch elevation tooltip ────────────────────────────────────
  const tooltipEl = createTooltipEl(map.getContainer())
  const containerW = () => map.getContainer().clientWidth

  let hideTimer: ReturnType<typeof setTimeout> | null = null
  let touchHideTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleHide() {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => { tooltipEl.style.display = 'none' }, 800)
  }
  function cancelHide() { if (hideTimer) clearTimeout(hideTimer) }
  tooltipEl.addEventListener('mouseenter', cancelHide)
  tooltipEl.addEventListener('mouseleave', () => { tooltipEl.style.display = 'none' })

  function showPolylineTooltip(p: MiniMapPolyline, e: { containerPoint: { x: number; y: number } }) {
    const stats = computeTrailStats(p.points)
    const desc  = p.difficulty
      ? placeholderDesc(p.difficulty)
      : 'Eine abwechslungsreiche Tour durch die Trailanlage.'
    tooltipEl.innerHTML = trailTooltipHtml(p.name, p.difficulty, desc, stats)
    const extra = options.tooltipActionHtml?.(p)
    if (extra) tooltipEl.querySelector('.ttr-bottom')?.insertAdjacentHTML('beforeend', extra)
    positionTooltip(tooltipEl, e.containerPoint.x, e.containerPoint.y, containerW())

    const onAction = options.onTooltipAction ?? options.onPolylineActivate
    if (onAction) {
      tooltipEl.querySelector('.ttr-open')?.addEventListener('click', (ev) => {
        ev.stopPropagation()
        onAction(p)
      }, { once: true })
    }
  }

  // Layers that setData() tears down and rebuilds — everything except the
  // base tile layer.
  let dataLayer = L.layerGroup().addTo(map)

  function addPolyline(p: MiniMapPolyline) {
    const latlngs = p.points.map(([la, ln]) => [la, ln] as [number, number])
    const visibleOpts = p.difficulty
      ? { color: DIFF_COLOR[p.difficulty] ?? '#888', weight: 6, opacity: 0.85 }
      : { color: '#555', weight: 5, opacity: 0.6, dashArray: '8, 6' }

    L.polyline(latlngs, { ...visibleOpts, interactive: false }).addTo(dataLayer)
    const hit = L.polyline(latlngs, { weight: 20, opacity: 0.001, color: '#000' }).addTo(dataLayer)

    hit.on('mouseover', (e: any) => { cancelHide(); showPolylineTooltip(p, e) })
    hit.on('mousemove', (e: any) => positionTooltip(tooltipEl, e.containerPoint.x, e.containerPoint.y, containerW()))
    hit.on('mouseout', scheduleHide)
    hit.on('touchstart', (e: any) => {
      if (touchHideTimer) clearTimeout(touchHideTimer)
      const touch = e.originalEvent.touches[0]
      const rect  = map.getContainer().getBoundingClientRect()
      showPolylineTooltip(p, { containerPoint: { x: touch.clientX - rect.left, y: touch.clientY - rect.top } })
      touchHideTimer = setTimeout(() => { tooltipEl.style.display = 'none' }, 3000)
    }, { passive: true })

    if (options.onPolylineActivate) {
      hit.on('click', () => options.onPolylineActivate!(p))
    }
  }

  function addMarker(m: MiniMapMarker) {
    const iconOpts = m.kind === 'parking'
      ? parkingIconOptions()
      : markerIconOptions(m.spotType ?? 'trail', m.approved ?? false)
    const marker = L.marker([m.lat, m.lng], { icon: L.divIcon(iconOpts) }).addTo(dataLayer)
    if (m.popupHtml) marker.bindPopup(m.popupHtml)
    else if (m.name) marker.bindPopup(`<strong>${m.name}</strong>`)
  }

  function setData(next: MiniMapInput) {
    dataLayer.remove()
    dataLayer = L.layerGroup().addTo(map)
    tooltipEl.style.display = 'none'

    // GPX tracks only render once past the zoom threshold (shared gate); the
    // markers the caller passes are always drawn. Callers that need the
    // embed-page's per-spot "track XOR marker" behaviour omit the spot
    // marker for spots whose GPX is showing (see the embed adapter).
    if (resolveShowGpx(next, options)) {
      for (const p of orderPolylines(next.polylines)) addPolyline(p)
    }
    for (const m of next.markers) addMarker(m)
  }

  setData(input)

  return {
    flyTo(lat: number, lng: number, zoom?: number) {
      map.flyTo([lat, lng], typeof zoom === 'number' ? zoom : map.getZoom(), { duration: 1 })
    },
    setData,
    destroy() {
      if (hideTimer) clearTimeout(hideTimer)
      if (touchHideTimer) clearTimeout(touchHideTimer)
      tooltipEl.remove()
      map.remove()
    },
  }
}
