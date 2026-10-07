import type * as Leaflet from 'leaflet'
import { GPX_ZOOM_THRESHOLD } from './gpxZoomThreshold'
import { renderField, sigmaPx } from './soilField'

export interface SoilPoint { lat: number; lon: number; axis: number; frost: boolean }

export interface SoilRadarLayer {
  setPoints(points: SoilPoint[]): void
  setVisible(on: boolean): void
  playIntro(): Promise<void>
  destroy(): void
}

const PANE = 'soilRadarPane'
const PAD = 0.25            // canvas overscan per side, so short pans don't show an edge
const SWEEP_MS = 1600

/** Clouds are fully opaque up to zoom 10 and gone at the GPX threshold (11). */
export function zoomOpacity(zoom: number): number {
  return Math.max(0, Math.min(1, GPX_ZOOM_THRESHOLD - zoom))
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Leaflet is injected (dynamic import lives in the composable); only the map API is used here.
export function createSoilRadarLayer(
  map: Leaflet.Map, _L: typeof Leaflet, opts: { radiusMeters?: number } = {},
): SoilRadarLayer {
  const radiusMeters = opts.radiusMeters ?? 20_000
  const pane = map.getPane(PANE) ?? map.createPane(PANE)
  pane.style.zIndex = '350'
  pane.style.pointerEvents = 'none'
  pane.classList.add('soil-radar-pane')

  const canvas = document.createElement('canvas')
  canvas.className = 'soil-radar-canvas leaflet-zoom-animated'
  pane.appendChild(canvas)
  const ctx = canvas.getContext('2d')

  let points: SoilPoint[] = []
  let visible = false
  let destroyed = false
  let origin = { x: 0, y: 0 }
  let originLatLng: Leaflet.LatLng | null = null
  let endIntro: (() => void) | null = null

  function redraw() {
    if (destroyed || !ctx) return
    const op = visible ? zoomOpacity(map.getZoom()) : 0
    canvas.style.opacity = String(op)
    if (op === 0) return // hidden: skip the work, the next visible redraw repaints

    const size = map.getSize()
    const padX = Math.round(size.x * PAD)
    const padY = Math.round(size.y * PAD)
    const w = size.x + padX * 2
    const h = size.y + padY * 2
    const topLeft = map.containerPointToLayerPoint([-padX, -padY])
    origin = { x: topLeft.x, y: topLeft.y }
    originLatLng = map.layerPointToLatLng(topLeft)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    canvas.style.transform = `translate3d(${origin.x}px,${origin.y}px,0)`

    if (!points.length) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    const cy = size.y / 2
    const a = map.containerPointToLatLng([0, cy])
    const b = map.containerPointToLatLng([100, cy])
    const sigma = sigmaPx(radiusMeters, map.distance(a, b) / 100)

    const projected = points.map(p => {
      const lp = map.latLngToLayerPoint([p.lat, p.lon])
      return { x: lp.x - origin.x, y: lp.y - origin.y, axis: p.axis, frost: p.frost }
    })
    const field = renderField(projected, w, h, sigma)
    canvas.width = field.width
    canvas.height = field.height
    const img = ctx.createImageData(field.width, field.height)
    img.data.set(field.data)
    ctx.putImageData(img, 0, 0)
  }

  // Follow Leaflet's zoom animation with a CSS transform; zoomend repaints exactly.
  function onZoomAnim(e: unknown) {
    const ev = e as { zoom: number; center: Leaflet.LatLng }
    const m = map as unknown as { _latLngToNewLayerPoint?: (ll: Leaflet.LatLng, z: number, c: Leaflet.LatLng) => { x: number; y: number } }
    if (!originLatLng || !m._latLngToNewLayerPoint) return
    const scale = map.getZoomScale(ev.zoom, map.getZoom())
    const off = m._latLngToNewLayerPoint(originLatLng, ev.zoom, ev.center)
    canvas.style.transform = `translate3d(${off.x}px,${off.y}px,0) scale(${scale})`
  }

  map.on('moveend', redraw)
  map.on('zoomend', redraw)
  map.on('resize', redraw)
  map.on('zoomanim', onZoomAnim)

  return {
    setPoints(next) {
      if (destroyed) return
      points = next
      redraw()
    },
    setVisible(on) {
      if (destroyed) return
      visible = on
      redraw()
    },
    playIntro() {
      if (destroyed || prefersReducedMotion()) return Promise.resolve()
      endIntro?.()
      const container = map.getContainer()
      const beam = document.createElement('div')
      beam.className = 'soil-beam'
      container.appendChild(beam)
      canvas.classList.add('soil-sweep')
      return new Promise<void>(resolve => {
        const timer = setTimeout(done, SWEEP_MS + 400) // animationend can be skipped (hidden tab)
        function done() {
          clearTimeout(timer)
          canvas.removeEventListener('animationend', done)
          canvas.classList.remove('soil-sweep')
          beam.remove()
          endIntro = null
          resolve()
        }
        endIntro = done
        canvas.addEventListener('animationend', done)
      })
    },
    destroy() {
      if (destroyed) return
      endIntro?.()
      destroyed = true
      map.off('moveend', redraw)
      map.off('zoomend', redraw)
      map.off('resize', redraw)
      map.off('zoomanim', onZoomAnim)
      canvas.remove()
    },
  }
}
