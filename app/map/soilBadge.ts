import type { ConditionLevel } from '../types/Weather'
import { markerIconOptions, type MarkerIconOptions } from './markerIcon'

/** L1 "Earth" ramp, axis 0..4: dusty → dry → prime → damp → wet. */
export const SOIL_PALETTE = ['#e0a526', '#8bbf3f', '#16c060', '#2ea8e6', '#6d4c41'] as const
export const SOIL_FROST = '#e8f4ff'
const SOIL_UNKNOWN = '#c9ccd0'
// White glyph needs a darker ground than the frost tint of the clouds.
const SOIL_SNOW_BADGE = '#7fa8cf'

export type SoilLevel = 'dusty' | 'dry' | 'prime' | 'damp' | 'wet' | 'raining' | 'snow'

const wrap = (inner: string) => `<svg class="soil-glyph" viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`

export const SOIL_GLYPHS: Record<SoilLevel, string> = {
  dusty:   wrap('<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'),
  dry:     wrap('<circle cx="12" cy="12" r="4.5" fill="#fff"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>'),
  prime:   wrap('<path d="M12 1.5l2.6 7.2 7.4.3-5.8 4.7 2 7.3L12 16.8 5.8 21l2-7.3L2 9l7.4-.3z" fill="#fff"/>'),
  damp:    wrap('<path d="M12 2.5C9 7 5.5 10.5 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10.5 15 7 12 2.5z" fill="#fff"/>'),
  wet:     wrap('<path d="M2 17c2-2 4 2 6 0s4 2 6 0 4 2 6 0M5 11c1.5-1.5 3 1.5 4.5 0M14 11c1.5-1.5 3 1.5 4.5 0" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="6" r="2" fill="#fff"/>'),
  raining: wrap('<path d="M7 14a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.5 8 3.5 3.5 0 0 1 17.5 14z" fill="#fff"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>'),
  snow:    wrap('<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
}

const LABELS: Record<SoilLevel, string> = {
  dusty: 'staubig', dry: 'trocken', prime: 'Hero Dirt', damp: 'feucht',
  wet: 'Matsch', raining: 'Regen', snow: 'Schnee',
}

// Badge colour = palette index; raining shares damp's colour.
const LEVEL_BUCKET: Record<SoilLevel, number> = {
  dusty: 0, dry: 1, prime: 2, damp: 3, wet: 4, raining: 3, snow: 4,
}

function isSoilLevel(level: ConditionLevel): level is SoilLevel {
  return level in LEVEL_BUCKET
}

const hex = (h: string): [number, number, number] =>
  [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
const STOPS = SOIL_PALETTE.map(hex)

/** Continuous ramp colour for an axis value (clamped to 0..4). */
export function axisRgb(axis: number): [number, number, number] {
  const v = Math.max(0, Math.min(4, axis))
  const i = Math.min(3, Math.floor(v))
  const t = v - i
  const a = STOPS[i]!
  const b = STOPS[i + 1]!
  return [0, 1, 2].map(k => Math.round(a[k]! + (b[k]! - a[k]!) * t)) as [number, number, number]
}

export function axisColor(axis: number): string {
  return '#' + axisRgb(axis).map(c => c.toString(16).padStart(2, '0')).join('')
}

function badgeBackground(level: SoilLevel): string {
  return level === 'snow' ? SOIL_SNOW_BADGE : SOIL_PALETTE[LEVEL_BUCKET[level]]!
}

/** Soil badge circle for a pin; '' for levels without a soil verdict. */
export function soilBadgeHtml(level: ConditionLevel, opts: { delayMs?: number } = {}): string {
  if (!isSoilLevel(level)) return ''
  const cls = ['soil-badge', `soil-badge-${level}`]
  if (level === 'prime') cls.push('soil-badge-hero')
  let style = `background:${badgeBackground(level)};`
  if (opts.delayMs !== undefined) {
    cls.push('soil-badge-pop')
    style += `animation-delay:${Math.max(0, Math.round(opts.delayMs))}ms;`
  }
  return `<div class="${cls.join(' ')}" style="${style}">${SOIL_GLYPHS[level]}</div>`
}

/** Today's pin plus a soil badge on its shoulder; same size/anchors as the plain pin. */
export function markerWithSoilBadgeOptions(
  type: string, approved: boolean, level: ConditionLevel, delayMs?: number,
): MarkerIconOptions {
  const base = markerIconOptions(type, approved)
  const badge = soilBadgeHtml(level, { delayMs })
  if (!badge) return base
  return { ...base, html: `<div class="soil-marker">${base.html}${badge}</div>` }
}

/** Cluster icon: donut of the children's soil shares, child count in the middle. */
export function clusterDonutHtml(levels: ConditionLevel[]): string {
  const counts = [0, 0, 0, 0, 0]
  let unknown = 0
  for (const l of levels) {
    if (isSoilLevel(l)) counts[LEVEL_BUCKET[l]]!++
    else unknown++
  }
  const segs: string[] = []
  let acc = 0
  const total = levels.length || 1
  const push = (color: string, n: number) => {
    if (!n) return
    const from = acc
    acc += (n / total) * 100
    segs.push(`${color} ${+from.toFixed(2)}% ${+acc.toFixed(2)}%`)
  }
  counts.forEach((n, i) => push(SOIL_PALETTE[i]!, n))
  push(SOIL_UNKNOWN, unknown)
  const glow = counts[2]! > 0 ? ' soil-donut-glow' : ''
  const bg = segs.length ? `background:conic-gradient(${segs.join(', ')});` : `background:${SOIL_UNKNOWN};`
  return `<div class="soil-donut${glow}" style="${bg}"><span class="soil-donut-n">${levels.length}</span></div>`
}

/** Glyph + label chip shown on a GPX track in the zoomed-in view; null without a verdict. */
export function soilChipOptions(level: ConditionLevel): MarkerIconOptions | null {
  if (!isSoilLevel(level)) return null
  const hero = level === 'prime' ? ' soil-chip-hero' : ''
  return {
    html: `<div class="soil-chip soil-chip-${level}${hero}" style="background:${badgeBackground(level)}">${SOIL_GLYPHS[level]}<span>${LABELS[level]}</span></div>`,
    iconSize: [92, 30],
    iconAnchor: [46, 15],
    popupAnchor: [0, -18],
    className: 'soil-chip-hit',
  }
}
