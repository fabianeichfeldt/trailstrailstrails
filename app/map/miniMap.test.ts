import { describe, it, expect, vi } from 'vitest'
import { createMiniMap, orderPolylines, resolveShowGpx, type MiniMapInput, type MiniMapPolyline } from './miniMap'

// Minimal Leaflet stand-in: records polylines and their event handlers so the miniMap → addTrackLayer wiring can be driven.
const lines: Array<{ opts: any; handlers: Record<string, (e?: any) => void> }> = []
vi.mock('leaflet-gesture-handling', () => ({}))
vi.mock('leaflet', () => {
  const layer = () => ({ addTo() { return this }, remove() {}, bindPopup() {} })
  return {
    default: {
      map: (el: HTMLElement) => ({
        setView() {}, setMaxZoom() {}, remove() {}, flyTo() {}, getZoom: () => 12,
        getContainer: () => el,
      }),
      tileLayer: layer,
      layerGroup: layer,
      marker: layer,
      divIcon: () => ({}),
      polyline: (_latlngs: unknown, opts: any) => {
        const entry = { opts, handlers: {} as Record<string, (e?: any) => void> }
        lines.push(entry)
        return { addTo() { return this }, on(ev: string, fn: (e?: any) => void) { entry.handlers[ev] = fn } }
      },
      DomEvent: { stop() {} },
    },
  }
})

function poly(id: string, kind: 'trail' | 'tour'): MiniMapPolyline {
  return { id, kind, name: id, difficulty: kind === 'trail' ? 'blue' : null, points: [[0, 0, 0], [1, 1, 0]] }
}

describe('orderPolylines', () => {
  it('puts every tour before every trail so trail hit-areas end up on top', () => {
    const ordered = orderPolylines([poly('t1', 'trail'), poly('to1', 'tour'), poly('t2', 'trail'), poly('to2', 'tour')])
    expect(ordered.map(p => p.id)).toEqual(['to1', 'to2', 't1', 't2'])
  })

  it('preserves the relative order within tours and within trails', () => {
    const ordered = orderPolylines([poly('a', 'trail'), poly('b', 'trail')])
    expect(ordered.map(p => p.id)).toEqual(['a', 'b'])
  })

  it('does not mutate the input array', () => {
    const input = [poly('t1', 'trail'), poly('to1', 'tour')]
    orderPolylines(input)
    expect(input.map(p => p.id)).toEqual(['t1', 'to1'])
  })
})

describe('resolveShowGpx', () => {
  const base: MiniMapInput = { center: [47, 11], zoom: 11, polylines: [], markers: [] }

  it('honours an explicit showGpxAtZoom override regardless of zoom/polylines', () => {
    expect(resolveShowGpx({ ...base, polylines: [poly('t', 'trail')], zoom: 5 }, { interactive: true, showGpxAtZoom: true })).toBe(true)
    expect(resolveShowGpx({ ...base, polylines: [poly('t', 'trail')], zoom: 18 }, { interactive: true, showGpxAtZoom: false })).toBe(false)
  })

  it('shows GPX when there are polylines and zoom is at/above the threshold', () => {
    expect(resolveShowGpx({ ...base, polylines: [poly('t', 'trail')], zoom: 11 }, { interactive: true })).toBe(true)
  })

  it('falls back to the spot marker when zoomed out below the threshold', () => {
    expect(resolveShowGpx({ ...base, polylines: [poly('t', 'trail')], zoom: 9 }, { interactive: true })).toBe(false)
  })

  it('falls back to the spot marker when there is no GPX at all', () => {
    expect(resolveShowGpx({ ...base, polylines: [], zoom: 14 }, { interactive: true })).toBe(false)
  })
})

describe('createMiniMap polyline wiring', () => {
  const trail = poly('t1', 'trail')
  const input: MiniMapInput = { center: [47, 11], zoom: 14, polylines: [trail], markers: [] }
  const hitLine = () => lines.find(l => l.opts.weight === 20)!

  async function setup(options: Parameters<typeof createMiniMap>[2]) {
    lines.length = 0
    const el = document.createElement('div')
    const handle = await createMiniMap(el, { ...input, polylines: [] }, options)
    handle.setData(input)
    return el
  }

  it('a click on the hit line activates that polyline', async () => {
    const onPolylineActivate = vi.fn()
    await setup({ interactive: true, onPolylineActivate })

    hitLine().handlers.click!()

    expect(onPolylineActivate).toHaveBeenCalledWith(trail)
  })

  it('hover shows the caller\'s action html in the tooltip, and its open button fires onTooltipAction', async () => {
    const onTooltipAction = vi.fn()
    const el = await setup({
      interactive: true,
      tooltipActionHtml: p => `<a class="ttr-open" data-id="${p.id}">Öffnen</a>`,
      onTooltipAction,
    })

    hitLine().handlers.mouseover!({ containerPoint: { x: 10, y: 10 } })

    const tooltip = el.querySelector('.ttr-wrapper')!
    expect(tooltip.querySelector('.ttr-bottom [data-id="t1"]')).not.toBeNull()
    ;(tooltip.querySelector('.ttr-open') as HTMLElement).click()
    expect(onTooltipAction).toHaveBeenCalledWith(trail)
  })
})
