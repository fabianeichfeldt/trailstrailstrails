import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSoilRadarLayer, zoomOpacity, type SoilPoint } from './soilRadarLayer'

type Fn = (e?: unknown) => void

function fakeMap(zoom = 8) {
  const container = document.createElement('div')
  const panes: Record<string, HTMLElement> = {}
  const handlers: Record<string, Fn[]> = {}
  const map = {
    zoom,
    getContainer: () => container,
    getPane: (n: string) => panes[n],
    createPane: vi.fn((n: string) => {
      const el = document.createElement('div')
      panes[n] = el
      container.appendChild(el)
      return el
    }),
    getSize: () => ({ x: 400, y: 800 }),
    getZoom: () => map.zoom,
    getZoomScale: () => 2,
    containerPointToLayerPoint: ([x, y]: number[]) => ({ x: x!, y: y! }),
    // 1 deg lon = 100px, lat 0 = y 0
    latLngToLayerPoint: ([lat, lon]: number[]) => ({ x: lon! * 100, y: -lat! * 100 }),
    containerPointToLatLng: ([x, y]: number[]) => ({ lat: -y! / 100, lng: x! / 100 }),
    layerPointToLatLng: (p: { x: number; y: number }) => ({ lat: -p.y / 100, lng: p.x / 100 }),
    distance: (a: { lng: number }, b: { lng: number }) => Math.abs(b.lng - a.lng) * 100 * 200, // 200 m/px
    on: vi.fn((ev: string, fn: Fn) => { (handlers[ev] ||= []).push(fn) }),
    off: vi.fn((ev: string, fn: Fn) => { handlers[ev] = (handlers[ev] || []).filter(f => f !== fn) }),
    fire: (ev: string, e?: unknown) => (handlers[ev] || []).slice().forEach(f => f(e)),
    handlers,
    panes,
    container,
  }
  return map
}

const L = {} as typeof import('leaflet')
const pts: SoilPoint[] = [
  { lat: -2, lon: 2, axis: 2, frost: false },
  { lat: -3, lon: 2.5, axis: 3, frost: false },
]

let put: ReturnType<typeof vi.fn>
let clear: ReturnType<typeof vi.fn>

beforeEach(() => {
  put = vi.fn()
  clear = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: put,
    clearRect: clear,
  })) as never)
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never
})
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('zoomOpacity', () => {
  it('is 1 up to zoom 8 and fades linearly to 0.25 at zoom 14', () => {
    expect(zoomOpacity(6)).toBe(1)
    expect(zoomOpacity(8)).toBe(1)
    expect(zoomOpacity(11)).toBeCloseTo(0.625)
    expect(zoomOpacity(14)).toBeCloseTo(0.25)
  })

  it('never fades out completely, however far you zoom in', () => {
    expect(zoomOpacity(17)).toBeCloseTo(0.25)
    expect(zoomOpacity(19)).toBeCloseTo(0.25)
  })
})

describe('createSoilRadarLayer', () => {
  it('creates its own pane above tiles and a canvas inside', () => {
    const map = fakeMap()
    createSoilRadarLayer(map as never, L)
    const pane = map.panes.soilRadarPane!
    expect(pane.style.zIndex).toBe('350')
    expect(pane.querySelector('canvas')).toBeTruthy()
  })

  it('registers and removes the same redraw listeners', () => {
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    for (const ev of ['moveend', 'zoomend', 'resize']) expect(map.handlers[ev]!.length).toBe(1)
    layer.destroy()
    for (const ev of ['moveend', 'zoomend', 'resize', 'zoomanim']) expect(map.handlers[ev]!.length).toBe(0)
    expect(map.panes.soilRadarPane!.querySelector('canvas')).toBeNull()
  })

  it('does not draw until visible, then draws a quarter-res grid with colour', () => {
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    layer.setPoints(pts)
    expect(put).not.toHaveBeenCalled()
    layer.setVisible(true)
    expect(put).toHaveBeenCalledTimes(1)
    const img = put.mock.calls[0]![0] as { width: number; height: number; data: Uint8ClampedArray }
    // viewport 400x800 plus 25% padding each side → 600x1200 → /4
    expect(img.width).toBe(150)
    expect(img.height).toBe(300)
    expect(img.data.some((v, i) => i % 4 === 3 && v > 0)).toBe(true)
    const canvas = map.panes.soilRadarPane!.querySelector('canvas')!
    expect(canvas.style.opacity).toBe('1')
  })

  it('setPoints on a visible layer redraws', () => {
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    layer.setVisible(true)
    layer.setPoints(pts)
    expect(put).toHaveBeenCalledTimes(1)
    layer.setPoints([pts[0]!])
    expect(put).toHaveBeenCalledTimes(2)
  })

  it('redraws on moveend, zoomend and resize', () => {
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    layer.setPoints(pts)
    layer.setVisible(true)
    put.mockClear()
    map.fire('moveend'); map.fire('zoomend'); map.fire('resize')
    expect(put).toHaveBeenCalledTimes(3)
  })

  it('stays drawn but fainter when zoomed into the GPX view', () => {
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    layer.setPoints(pts)
    layer.setVisible(true)
    const canvas = map.panes.soilRadarPane!.querySelector('canvas')!
    put.mockClear()
    map.zoom = 14
    map.fire('zoomend')
    expect(Number(canvas.style.opacity)).toBeCloseTo(0.25)
    expect(put).toHaveBeenCalled()
  })

  it('hides and skips drawing when invisible', () => {
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    layer.setPoints(pts)
    layer.setVisible(true)
    const canvas = map.panes.soilRadarPane!.querySelector('canvas')!
    layer.setVisible(false)
    put.mockClear()
    map.fire('moveend')
    expect(canvas.style.opacity).toBe('0')
    expect(put).not.toHaveBeenCalled()
  })

  it('clears the canvas when points become empty', () => {
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    layer.setVisible(true)
    layer.setPoints(pts)
    layer.setPoints([])
    expect(clear).toHaveBeenCalled()
  })

  it('ignores calls after destroy', () => {
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    layer.destroy()
    layer.setVisible(true)
    layer.setPoints(pts)
    expect(put).not.toHaveBeenCalled()
    expect(() => layer.destroy()).not.toThrow()
  })
})

describe('playIntro', () => {
  it('resolves immediately under prefers-reduced-motion, without sweep markup', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    layer.setVisible(true)
    await layer.playIntro()
    const canvas = map.panes.soilRadarPane!.querySelector('canvas')!
    expect(canvas.classList.contains('soil-sweep')).toBe(false)
    expect(map.container.querySelector('.soil-beam')).toBeNull()
  })

  it('sweeps and cleans up when the animation ends', async () => {
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    layer.setVisible(true)
    const canvas = map.panes.soilRadarPane!.querySelector('canvas')!
    const p = layer.playIntro()
    expect(canvas.classList.contains('soil-sweep')).toBe(true)
    expect(map.container.querySelector('.soil-beam')).toBeTruthy()
    canvas.dispatchEvent(new Event('animationend'))
    await p
    expect(canvas.classList.contains('soil-sweep')).toBe(false)
    expect(map.container.querySelector('.soil-beam')).toBeNull()
  })

  it('falls back to a timeout if animationend never fires', async () => {
    vi.useFakeTimers()
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    layer.setVisible(true)
    const p = layer.playIntro()
    await vi.advanceTimersByTimeAsync(3000)
    await p
    expect(map.container.querySelector('.soil-beam')).toBeNull()
  })

  it('resolves when destroyed mid-sweep', async () => {
    const map = fakeMap()
    const layer = createSoilRadarLayer(map as never, L)
    layer.setVisible(true)
    const p = layer.playIntro()
    layer.destroy()
    await p
    expect(map.container.querySelector('.soil-beam')).toBeNull()
  })
})
