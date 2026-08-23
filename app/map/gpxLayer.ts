import { computeTrailStats, trailTooltipHtml, positionTooltip } from './trailTooltip'

export interface HideController {
  schedule: () => void
  cancel: () => void
}

export function createHideController(tooltipEl: HTMLElement): HideController {
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    schedule() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { tooltipEl.style.display = 'none' }, 800)
    },
    cancel() {
      if (timer) clearTimeout(timer)
    },
  }
}

/**
 * Adds a visible GPX polyline + invisible hit area to the map, wired to the
 * shared elevation tooltip. Returns both layers so callers can track them.
 *
 * @param onTouch - optional override for touchstart (used by the main map for
 *   double-tap-to-open). When omitted, a single-tap shows the tooltip for 3 s.
 */
export function addGpxPolyline(
  L: any,
  map: any,
  tooltipEl: HTMLElement,
  containerW: () => number,
  latlngs: [number, number][],
  visibleOpts: Record<string, unknown>,
  name: string,
  difficulty: string | null,
  points: [number, number, number][],
  description: string,
  hide: HideController,
  onOpen: (ev: Event) => void,
  onTouch?: (e: any, show: (x: number, y: number) => void) => void,
): { line: any; hit: any } {
  const stats = computeTrailStats(points)
  const words = description ? description.split(/\s+/) : []
  const desc  = words.length > 150 ? words.slice(0, 150).join(' ') + '…' : description

  const line = L.polyline(latlngs, { ...visibleOpts, interactive: false }).addTo(map)
  const hit  = L.polyline(latlngs, { weight: 20, opacity: 0.001, color: '#000' }).addTo(map)

  function show(x: number, y: number) {
    tooltipEl.innerHTML = trailTooltipHtml(name, difficulty, desc, stats)
    positionTooltip(tooltipEl, x, y, containerW())
    tooltipEl.querySelector('.ttr-open')?.addEventListener('click', onOpen, { once: true })
  }

  hit.on('mouseover', (e: any) => { hide.cancel(); show(e.containerPoint.x, e.containerPoint.y) })
  hit.on('mousemove', (e: any) => positionTooltip(tooltipEl, e.containerPoint.x, e.containerPoint.y, containerW()))
  hit.on('mouseout',  () => hide.schedule())

  if (onTouch) {
    hit.on('touchstart', (e: any) => onTouch(e, show), { passive: false })
  } else {
    let touchTimer: ReturnType<typeof setTimeout> | null = null
    hit.on('touchstart', (e: any) => {
      if (touchTimer) clearTimeout(touchTimer)
      const touch = e.originalEvent.touches[0]
      const rect  = map.getContainer().getBoundingClientRect()
      show(touch.clientX - rect.left, touch.clientY - rect.top)
      touchTimer = setTimeout(() => { tooltipEl.style.display = 'none' }, 3000)
    }, { passive: true })
  }

  return { line, hit }
}
