export const DIFF_COLOR: Record<string, string> = {
  green: '#2e7d32',
  blue:  '#1565c0',
  red:   '#c62828',
  black: '#1a1a1a',
}

const DIFF_LABEL: Record<string, string> = {
  green: 'Grün',
  blue:  'Blau',
  red:   'Rot',
  black: 'Schwarz',
}

// Placeholder per-difficulty descriptions — replace once the DB column exists.
const PLACEHOLDER: Record<string, string> = {
  green: 'Flüssiger Flow-Trail, ideal für alle Levels und zum Aufwärmen der Beine.',
  blue:  'Abwechslungsreich mit Kurven, kleinen Drops und technischen Passagen.',
  red:   'Anspruchsvoll mit steilen Sektionen, Wurzeln und mittleren Drops.',
  black: 'Nur für Experten: extreme Abfahrten, große Drops, technische Hindernisse.',
}

export function placeholderDesc(difficulty: string): string {
  return PLACEHOLDER[difficulty] ?? 'Ein spannender Trail in dieser Anlage.'
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface TrailStats {
  distanceKm: string
  elevGain: number
  elevLoss: number
  profilePath: string   // SVG closed area path — viewBox "0 0 260 44"
}

export function computeTrailStats(points: [number, number, number][]): TrailStats {
  if (points.length < 2) {
    return { distanceKm: '0.0', elevGain: 0, elevLoss: 0, profilePath: '' }
  }

  let dist = 0
  let gain = 0
  let loss = 0
  const dists: number[] = [0]

  for (let i = 1; i < points.length; i++) {
    dist += haversineKm(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])
    dists.push(dist)
    const dElev = points[i][2] - points[i - 1][2]
    if (dElev > 0) gain += dElev
    else loss += Math.abs(dElev)
  }

  const elevs = points.map(p => p[2])
  const minE  = Math.min(...elevs)
  const maxE  = Math.max(...elevs)
  const range = maxE - minE || 1
  const W = 260
  const H = 44

  const pts = points.map((_, i) => {
    const x = ((dists[i] / dist) * W).toFixed(1)
    const y = (H - ((elevs[i] - minE) / range) * (H - 6) - 3).toFixed(1)
    return `${x},${y}`
  })
  const profilePath = `M0,${H} L${pts.join(' L')} L${W},${H} Z`

  return {
    distanceKm: dist.toFixed(1),
    elevGain:   Math.round(gain),
    elevLoss:   Math.round(loss),
    profilePath,
  }
}

export function trailTooltipHtml(
  name: string,
  difficulty: string | null,
  description: string,
  stats: TrailStats,
): string {
  const isTour = !difficulty
  const color  = isTour ? '#37474f' : (DIFF_COLOR[difficulty!] ?? '#455a64')
  const label  = isTour ? 'Tour'    : (DIFF_LABEL[difficulty!] ?? difficulty!)

  const profileSvg = stats.profilePath
    ? `<div class="ttr-chart">
        <svg class="ttr-svg" viewBox="0 0 260 44" preserveAspectRatio="none">
          <defs>
            <linearGradient id="ttrG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stop-color="rgba(255,255,255,0.35)"/>
              <stop offset="100%" stop-color="rgba(255,255,255,0.04)"/>
            </linearGradient>
          </defs>
          <path d="${stats.profilePath}" fill="url(#ttrG)" stroke="rgba(255,255,255,0.85)" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </div>`
    : ''

  return `<div class="ttr-card" style="--ttr-color:${color}">
    <div class="ttr-top">
      <span class="ttr-badge">${label}</span>
      <span class="ttr-name">${name}</span>
    </div>
    <p class="ttr-desc">${description}</p>
    ${profileSvg}
    <div class="ttr-bottom">
      <div class="ttr-stats">
        <span class="ttr-stat"><span class="ttr-si">⇔</span>${stats.distanceKm}&thinsp;km</span>
        <span class="ttr-stat"><span class="ttr-si">↑</span>${stats.elevGain}&thinsp;m</span>
        <span class="ttr-stat"><span class="ttr-si">↓</span>${stats.elevLoss}&thinsp;m</span>
      </div>
      <button class="ttr-open" type="button">Spot öffnen ›</button>
    </div>
  </div>`
}

/** Position the tooltip wrapper near a map-container point, keeping it within bounds. */
export function positionTooltip(
  el: HTMLElement,
  x: number,
  y: number,
  containerW: number,
): void {
  const cardW   = 292
  const gap     = 16
  const approxH = 195  // worst-case card height (with SVG profile)

  let left = x
  if (left < cardW / 2)           left = cardW / 2
  if (left > containerW - cardW / 2) left = containerW - cardW / 2

  // Flip below cursor when too close to top of the map
  const aboveTransform = `translate(-50%, calc(-100% - ${gap}px))`
  const belowTransform = `translate(-50%, ${gap}px)`
  const transform = y > approxH + gap ? aboveTransform : belowTransform

  el.style.left      = `${left}px`
  el.style.top       = `${y}px`
  el.style.transform = transform
  el.style.display   = 'block'
}

/** Create and attach the tooltip wrapper div to a Leaflet map container. */
export function createTooltipEl(mapContainer: HTMLElement): HTMLElement {
  const el = document.createElement('div')
  el.className = 'ttr-wrapper'
  el.style.display = 'none'
  mapContainer.appendChild(el)
  return el
}
