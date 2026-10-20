import type { Trail } from '../types/Trail'
import type { ConditionLevel } from '../types/Weather'
import type { SoilMapSpot } from '../types/SoilMap'
import { isFrost } from '../types/SoilMap'
import { soilAxis } from '../types/soilScale'
import { markerIconOptions, type MarkerIconOptions } from './markerIcon'
import { markerWithSoilBadgeOptions, soilChipOptions } from './soilBadge'
import { soilMarkerState, introDelayMs, countSoilInView } from './soilView'

// Leaflet-free: trails + soil state (+ view bounds) in, per-marker view model out; useTrailMap applies it.

export type SoilRange = { lo: number; hi: number }
export type ViewBounds = { south: number; north: number; west: number; east: number }
export type LatLon = { lat: number; lon: number }

/** The slice of the soil-radar store the map presentation reads (the store satisfies it as-is). */
export interface SoilInput {
  enabled: boolean
  mode: 'live' | 'sample'
  range: SoilRange
  points: ReadonlyArray<SoilMapSpot>
  verdictFor(type: string, id: string): ConditionLevel | undefined
}

export interface SoilPoint { lat: number; lon: number; axis: number; frost: boolean }

export interface PinView {
  lat: number
  lon: number
  type: string
  approved: boolean
  /** undefined → plain pin, no badge. */
  level: ConditionLevel | undefined
  ghost: boolean
  delayMs?: number
  /** null = sample demo pin: not a real spot, not clickable. */
  trail: Trail | null
}

export interface ChipView { lat: number; lon: number; icon: MarkerIconOptions }

// 'none' = no soil verdict; soilMarkerState shows those only while the range is the full 0..4
export function soilMatch(level: ConditionLevel | undefined, range: SoilRange): 'match' | 'ghost' | 'none' {
  const axis = soilAxis(level)
  if (axis === null) return 'none'
  return axis >= range.lo && axis <= range.hi ? 'match' : 'ghost'
}

/** Whether a badge with this level is dimmed under the range; pins without a level never ghost. */
export function pinGhost(level: ConditionLevel | undefined, range: SoilRange): boolean {
  return !!level && soilMarkerState(soilMatch(level, range), range) === 'ghost'
}

const sampleMode = (soil: SoilInput) => soil.enabled && soil.mode === 'sample'

/**
 * Overview pins. `visible` is already type-filtered by filtersStore.apply().
 * `introCenter` set → angle-based badge pop delays (intro render only).
 */
export function markerPins(visible: ReadonlyArray<Trail>, soil: SoilInput, introCenter?: LatLon | null): PinView[] {
  const center = introCenter ?? null
  // The sample demo replaces the real pins, or clusters would mix fake and real spots.
  if (sampleMode(soil)) {
    return soil.points.map(s => ({
      lat: s.lat, lon: s.lon, type: s.t, approved: true, level: s.lvl,
      ghost: pinGhost(s.lvl, soil.range),
      delayMs: center ? introDelayMs(center, s) : undefined,
      trail: null,
    }))
  }
  // Real pins carry soil styling only in live mode.
  const live = soil.enabled && soil.mode === 'live'
  return visible.map(t => {
    const level = live ? soil.verdictFor(t.type, t.id) : undefined
    return {
      lat: t.latitude, lon: t.longitude, type: t.type, approved: t.approved, level,
      ghost: pinGhost(level, soil.range),
      delayMs: center && level ? introDelayMs(center, { lat: t.latitude, lon: t.longitude }) : undefined,
      trail: t,
    }
  })
}

/** Leaflet divIcon options for a pin: plain without a level, badged (and maybe ghosted) with one. */
export function pinIconOptions(pin: Pick<PinView, 'type' | 'approved' | 'level' | 'ghost' | 'delayMs'>): MarkerIconOptions {
  if (!pin.level) return markerIconOptions(pin.type, pin.approved)
  const o = markerWithSoilBadgeOptions(pin.type, pin.approved, pin.level, pin.delayMs)
  return pin.ghost ? { ...o, className: `${o.className} soil-ghost`.trim() } : o
}

/** Levels for the cluster donut; null → Leaflet's default cluster icon (radar off). */
export function clusterLevels(children: ReadonlyArray<Pick<PinView, 'level'> | undefined>, soilEnabled: boolean): ConditionLevel[] | null {
  if (!soilEnabled) return null
  return children.map(c => c?.level ?? 'unknown')
}

const inBounds = (p: LatLon, b: ViewBounds) =>
  p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east

/** GPX view (zoomed in): one soil chip per in-view spot with a verdict. `visible` = filtersStore.apply() output. */
export function soilChips(visible: ReadonlyArray<Trail>, soil: SoilInput, bounds: ViewBounds): ChipView[] {
  if (!soil.enabled) return []
  const spots: Array<{ lat: number; lon: number; lvl: ConditionLevel | undefined }> = soil.mode === 'sample'
    ? [...soil.points]
    : visible.map(t => ({ lat: t.latitude, lon: t.longitude, lvl: soil.verdictFor(t.type, t.id) }))
  const chips: ChipView[] = []
  for (const s of spots) {
    if (!s.lvl || !inBounds(s, bounds)) continue
    const opts = soilChipOptions(s.lvl)
    if (!opts) continue
    const ghost = pinGhost(s.lvl, soil.range)
    // Anchored below the coordinate so the chip doesn't sit on the spot's own pin.
    chips.push({
      lat: s.lat, lon: s.lon,
      icon: { ...opts, iconAnchor: [46, -4], className: ghost ? `${opts.className} soil-ghost` : opts.className },
    })
  }
  return chips
}

/** Cloud points for the radar layer: only spots matching the range. */
export function radarPoints(soil: SoilInput): SoilPoint[] {
  if (!soil.enabled) return []
  const pts: SoilPoint[] = []
  for (const s of soil.points) {
    if (soilMatch(s.lvl, soil.range) !== 'match') continue
    pts.push({ lat: s.lat, lon: s.lon, axis: soilAxis(s.lvl)!, frost: isFrost(s.lvl) })
  }
  return pts
}

/** Counter chip: spots in view matching the range / all spots in view with data. */
export function soilCountsInView(soil: SoilInput, bounds: ViewBounds): { matchCount: number; totalCount: number } {
  if (!soil.enabled) return { matchCount: 0, totalCount: 0 }
  return countSoilInView(soil.points, bounds, soil.range, soilMatch)
}
