import type { ConditionLevel } from '../types/Weather'
import { SOIL_PALETTE, SOIL_LABELS, isSoilMapLevel, soilAxis, type SoilLevel } from '../types/soilScale'
import { markerIconOptions, type MarkerIconOptions } from './markerIcon'

export const SOIL_FROST = '#e8f4ff'
const SOIL_UNKNOWN = '#c9ccd0'
// White glyph needs a darker ground than the frost tint of the clouds.
const SOIL_SNOW_BADGE = '#7fa8cf'

// Raw strings, not components: Leaflet divIcons and v-html need plain markup.
const RAW = import.meta.glob<string>('../assets/icons/soil/*.svg', { query: '?raw', import: 'default', eager: true })

/** Badge styling hook + hidden from assistive tech; the label beside it carries the meaning. */
const glyph = (level: SoilLevel) =>
  RAW[`../assets/icons/soil/${level}.svg`]!.trim().replace(/^<svg\b/, '<svg class="soil-glyph" aria-hidden="true"')

export const SOIL_GLYPHS: Record<SoilLevel, string> = {
  dusty: glyph('dusty'), dry: glyph('dry'), prime: glyph('prime'), damp: glyph('damp'),
  wet: glyph('wet'), raining: glyph('raining'), snow: glyph('snow'),
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
  return level === 'snow' ? SOIL_SNOW_BADGE : SOIL_PALETTE[soilAxis(level)!]!
}

/** Ground colour behind a level's white glyph; null for levels without a soil verdict. */
export function soilBadgeColor(level: ConditionLevel): string | null {
  return isSoilMapLevel(level) ? badgeBackground(level) : null
}

/** Soil badge circle for a pin; '' for levels without a soil verdict. */
export function soilBadgeHtml(level: ConditionLevel, opts: { delayMs?: number } = {}): string {
  if (!isSoilMapLevel(level)) return ''
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
  const counts = SOIL_PALETTE.map(() => 0)
  let unknown = 0
  for (const l of levels) {
    if (isSoilMapLevel(l)) counts[soilAxis(l)!]!++
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
  if (!isSoilMapLevel(level)) return null
  const hero = level === 'prime' ? ' soil-chip-hero' : ''
  return {
    html: `<div class="soil-chip soil-chip-${level}${hero}" style="background:${badgeBackground(level)}">${SOIL_GLYPHS[level]}<span>${SOIL_LABELS[level]}</span></div>`,
    iconSize: [92, 30],
    iconAnchor: [46, 15],
    popupAnchor: [0, -18],
    className: 'soil-chip-hit',
  }
}
