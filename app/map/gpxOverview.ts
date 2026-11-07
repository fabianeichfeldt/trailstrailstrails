import type { Trail } from '../types/Trail'
import type { SpotParkingLot } from '../communication/trails'
import { deriveTrailStatus, type TrailStatusResult } from '../types/TrailStatus'
import { DIFF_COLOR } from './trailTooltip'

// Leaflet-free: filtered spots + gpx/parking caches + now in, the GPX-view layers out; useTrailMap draws them.

type LatLng = [number, number]
type Point3 = [number, number, number]

export interface GpxTrailInput {
  name: string
  difficulty: string
  gpx_points: Point3[]
  trail_description?: string | null
  closed_from?: string | null
  closed_to?: string | null
  hint?: string | null
}
export interface GpxTourInput { name: string; gpx_points: Point3[] }
export interface GpxCacheEntry { trails: GpxTrailInput[]; tours: GpxTourInput[] }

export interface LineStyle { color: string; weight: number; opacity: number; dashArray?: string }

export interface OverviewLine {
  spot: Trail
  kind: 'tour' | 'trail'
  name: string
  difficulty: string | null
  points: Point3[]
  latlngs: LatLng[]
  style: LineStyle
  description: string
}

export interface OverviewBadge {
  spot: Trail
  latlng: LatLng
  status: TrailStatusResult & { state: 'closing_soon' | 'closed' }
}

export interface OverviewParking { spot: Trail; lat: number; lng: number }

export interface GpxOverview {
  /** Every spot keeps its pin, tracks or not. */
  pins: Trail[]
  /** Per spot tours first (lower z-order), then trails. */
  lines: OverviewLine[]
  badges: OverviewBadge[]
  parking: OverviewParking[]
}

export const TOUR_STYLE: LineStyle = { color: '#555', weight: 3, opacity: 0.6, dashArray: '8, 6' }

export function trailStyle(difficulty: string): LineStyle {
  return { color: DIFF_COLOR[difficulty] ?? '#888', weight: 4, opacity: 0.85 }
}

const toLatLngs = (pts: Point3[]): LatLng[] => pts.map(([la, ln]) => [la, ln] as LatLng)

/** Ids of the spots whose entry is missing from `cache`. */
export function uncachedIds(spots: Trail[], cache: ReadonlyMap<string, unknown>): string[] {
  return spots.filter(s => !cache.has(s.id)).map(s => s.id)
}

export function gpxOverview(
  spots: Trail[],
  gpxCache: ReadonlyMap<string, GpxCacheEntry>,
  parkingCache: ReadonlyMap<string, SpotParkingLot[]>,
  now: Date,
): GpxOverview {
  const out: GpxOverview = { pins: [], lines: [], badges: [], parking: [] }

  for (const spot of spots) {
    out.pins.push(spot)
    const gpx = gpxCache.get(spot.id)
    if (!gpx) continue

    for (const t of gpx.tours) {
      out.lines.push({
        spot, kind: 'tour', name: t.name, difficulty: null, points: t.gpx_points,
        latlngs: toLatLngs(t.gpx_points), style: TOUR_STYLE, description: '',
      })
    }
    for (const t of gpx.trails) {
      const latlngs = toLatLngs(t.gpx_points)
      out.lines.push({
        spot, kind: 'trail', name: t.name, difficulty: t.difficulty, points: t.gpx_points,
        latlngs, style: trailStyle(t.difficulty), description: t.trail_description ?? '',
      })
      const status = deriveTrailStatus({ closed_from: t.closed_from, closed_to: t.closed_to, hint: t.hint }, now)
      if (status.state !== 'open' && latlngs.length) {
        out.badges.push({
          spot, latlng: latlngs[Math.floor(latlngs.length / 2)],
          status: status as OverviewBadge['status'],
        })
      }
    }
  }

  for (const spot of spots) {
    for (const lot of parkingCache.get(spot.id) ?? []) out.parking.push({ spot, lat: lot.lat, lng: lot.lng })
  }
  return out
}

/** Same thresholds as leaflet.markercluster's default icon. */
export function clusterSize(count: number): 'small' | 'medium' | 'large' {
  return count < 10 ? 'small' : count < 100 ? 'medium' : 'large'
}
