import { computeTrailStats, trailTooltipHtml, positionTooltip } from './trailTooltip'

// The one track-interaction module (hit area, hover/touch tooltip, highlight) shared by the live map and the mini-map.

export interface HideController {
  schedule: (ms?: number) => void
  cancel: () => void
}

/** Delayed hide of the tooltip; a new schedule() restarts the timer. */
export function createHideController(tooltipEl: HTMLElement, onHide?: () => void): HideController {
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    schedule(ms = 800) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { tooltipEl.style.display = 'none'; onHide?.() }, ms)
    },
    cancel() {
      if (timer) clearTimeout(timer)
    },
  }
}

/** Keeps the tooltip while the pointer is on it (so "Spot öffnen" is clickable); leaving hides it at once. */
export function bindTooltipHover(tooltipEl: HTMLElement, hide: HideController): void {
  tooltipEl.addEventListener('mouseenter', () => hide.cancel())
  tooltipEl.addEventListener('mouseleave', () => { tooltipEl.style.display = 'none' })
}

export interface TapDetector {
  /** Registers a tap; true when it is the second tap on the same id within the window. */
  tap: (id: string) => boolean
}

/** Shared across all hit lines so consecutive taps on one trail count even when the hit objects differ. */
export function createTapDetector(windowMs: number, now: () => number = Date.now): TapDetector {
  let lastMs = 0
  let lastId = ''
  return {
    tap(id) {
      const t = now()
      if (t - lastMs < windowMs && lastId === id) {
        lastMs = 0
        return true
      }
      lastMs = t
      lastId = id
      return false
    },
  }
}

interface StyledLine {
  line: any
  opts: { weight?: number; opacity?: number }
}

/** Hover emphasis of one line among the visible lines of all spots. */
export function createLineHighlighter() {
  let bySpot = new Map<string, StyledLine[]>()
  return {
    register(spotId: string, line: any, opts: StyledLine['opts']) {
      const entries = bySpot.get(spotId) ?? []
      entries.push({ line, opts })
      bySpot.set(spotId, entries)
    },
    highlight(target: any) {
      bySpot.forEach(entries => {
        for (const { line, opts } of entries) {
          if (line === target) {
            line.setStyle({ weight: (opts.weight ?? 4) + 2, opacity: 1 })
            line.bringToFront()
          } else {
            line.setStyle({ weight: (opts.weight ?? 4) - 1, opacity: 0.3 })
          }
        }
      })
    },
    reset() {
      bySpot.forEach(entries => {
        for (const { line, opts } of entries) line.setStyle({ weight: opts.weight, opacity: opts.opacity })
      })
    },
    clear() { bySpot = new Map() },
  }
}

export type LineHighlighter = ReturnType<typeof createLineHighlighter>

export interface TrackLayerOptions {
  L: any
  map: any
  /** Layer/map the lines are added to. */
  parent: any
  tooltipEl: HTMLElement
  hide: HideController
  latlngs: [number, number][]
  visibleOpts: { weight?: number; opacity?: number; [k: string]: unknown }
  name: string
  difficulty: string | null
  points: [number, number, number][]
  description: string
  /** "Spot öffnen" button; also dblclick / double-tap when `doubleTap` is set. */
  onOpen?: () => void
  /** Plain click on the hit line. */
  onClick?: () => void
  extraActionHtml?: () => string | null
  /** Enables dblclick + double-tap → onOpen; the id is what counts as "the same trail". */
  doubleTap?: { detector: TapDetector; id: string }
  highlighter?: LineHighlighter
  /** Groups the line under its spot in the highlighter. */
  spotId?: string
  /** Timer for the 3 s touch tooltip; pass one to share it across lines. */
  touchHide?: HideController
}

const truncateWords = (text: string, max = 150) => {
  const words = text ? text.split(/\s+/) : []
  return words.length > max ? words.slice(0, max).join(' ') + '…' : text
}

/** Adds the decorative line + wide invisible hit line and wires the shared elevation tooltip. */
export function addTrackLayer(o: TrackLayerOptions): { line: any; hit: any } {
  const { L, map, tooltipEl, hide, highlighter } = o
  const containerW = () => map.getContainer().clientWidth
  const stats = computeTrailStats(o.points)
  const desc = truncateWords(o.description)

  const line = L.polyline(o.latlngs, { ...o.visibleOpts, interactive: false }).addTo(o.parent)
  if (o.spotId) highlighter?.register(o.spotId, line, o.visibleOpts)
  // weight 20 / opacity 0.001: a valid SVG pointer-events target that stays invisible
  const hit = L.polyline(o.latlngs, { weight: 20, opacity: 0.001, color: '#000' }).addTo(o.parent)

  function show(x: number, y: number) {
    tooltipEl.innerHTML = trailTooltipHtml(o.name, o.difficulty, desc, stats)
    const extra = o.extraActionHtml?.()
    if (extra) tooltipEl.querySelector('.ttr-bottom')?.insertAdjacentHTML('beforeend', extra)
    positionTooltip(tooltipEl, x, y, containerW())
    const onOpen = o.onOpen
    if (onOpen) {
      tooltipEl.querySelector('.ttr-open')?.addEventListener('click', (ev) => {
        ev.stopPropagation()
        onOpen()
      }, { once: true })
    }
  }

  hit.on('mouseover', (e: any) => {
    highlighter?.highlight(line)
    hide.cancel()
    show(e.containerPoint.x, e.containerPoint.y)
  })
  hit.on('mousemove', (e: any) => positionTooltip(tooltipEl, e.containerPoint.x, e.containerPoint.y, containerW()))
  hit.on('mouseout', () => {
    highlighter?.reset()
    hide.schedule()
  })

  const touchHide = o.touchHide ?? createHideController(tooltipEl, () => highlighter?.reset())
  const dt = o.doubleTap
  if (dt) {
    hit.on('dblclick', (e: any) => {
      L.DomEvent.stop(e)
      o.onOpen?.()
    })
  }
  hit.on('touchstart', (e: any) => {
    if (dt?.detector.tap(dt.id)) {
      L.DomEvent.stop(e)
      touchHide.cancel()
      highlighter?.reset()
      o.onOpen?.()
      return
    }
    highlighter?.highlight(line)
    const touch = e.originalEvent.touches[0]
    const rect = map.getContainer().getBoundingClientRect()
    if (dt) hide.cancel()
    show(touch.clientX - rect.left, touch.clientY - rect.top)
    touchHide.schedule(3000)
  }, { passive: !dt })

  if (o.onClick) hit.on('click', () => o.onClick!())

  return { line, hit }
}
