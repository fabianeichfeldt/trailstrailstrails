import { ElevationPoint, ImbaColor, MtbTrail, MtbTour, SpotMtbData, TourSegment, TrailDirection } from '../types/MtbTypes';
import { parseGpx } from './gpxParser';

// ── Config types (what the user writes in spotData.ts) ───────────────────────

export interface TrailConfig {
  name:       string;
  difficulty: ImbaColor;
  direction:  TrailDirection;
  /** Paste a full GPX file or bare <trkpt> lines between the backticks */
  gpx:        string;
}

export interface TourConfig {
  name:             string;
  duration_minutes: number;
  direction:        'cw' | 'ccw';
  /** Trail names in the order they are ridden. Transfers are auto-generated when no gpx is given. */
  trailNames:       string[];
  /**
   * Paste the full tour GPX here (or just the <trkpt> lines).
   * When provided: used for the elevation profile and the full-route map line.
   * When omitted:  transfers between trails are auto-generated.
   */
  gpx?:             string;
}

export interface SpotConfig {
  trails: TrailConfig[];
  tours:  TourConfig[];
}

// ── Registry ──────────────────────────────────────────────────────────────────

const registry = new Map<string, SpotMtbData>();

/**
 * Call this in spotData.ts for each spot that has real GPX data.
 * spotId must match the trail.id coming from the database.
 */
export function registerSpot(spotId: string, config: SpotConfig): void {
  registry.set(spotId, buildFromConfig(spotId, config));
}

export function getRegisteredData(spotId: string): SpotMtbData | undefined {
  return registry.get(spotId);
}

// ── Builder ───────────────────────────────────────────────────────────────────

function buildFromConfig(spotId: string, config: SpotConfig): SpotMtbData {
  // 1. Build MtbTrail objects
  const trails: MtbTrail[] = config.trails.map((tc, i) => {
    const pts     = parseGpx(tc.gpx);
    const profile = toProfile(pts);
    return {
      id:               `${spotId}-trail-${i}`,
      spotId,
      name:             tc.name,
      difficulty:       tc.difficulty,
      direction:        tc.direction,
      distance_km:      Math.round((profile[profile.length - 1]?.dist ?? 0) * 10) / 10,
      elevation_gain:   calcGain(profile),
      elevation_loss:   calcLoss(profile),
      gpxPoints:        pts,
      elevationProfile: profile,
    };
  });

  // 2. Build MtbTour objects
  // Base = the lowest-altitude trail endpoint (closest to the trailhead/parking)
  const allEndpoints = trails.flatMap(t => [t.gpxPoints[0], t.gpxPoints[t.gpxPoints.length - 1]]);
  const base: [number, number, number] = allEndpoints.reduce((lowest, p) =>
    p[2] < lowest[2] ? p : lowest, allEndpoints[0] ?? [0, 0, 0]);

  const tours: MtbTour[] = config.tours.map((tc, i) => {
    const sequence = tc.trailNames
      .map(name => trails.find(t => t.name === name))
      .filter((t): t is MtbTrail => t !== undefined);

    if (tc.gpx) {
      return buildTourFromGpx({
        id:               `${spotId}-tour-${i}`,
        spotId,
        name:             tc.name,
        trailSequence:    sequence,
        direction:        tc.direction,
        duration_minutes: tc.duration_minutes,
        gpx:              tc.gpx,
      });
    }

    return buildTour({
      id:               `${spotId}-tour-${i}`,
      spotId,
      name:             tc.name,
      trailSequence:    sequence,
      base,
      direction:        tc.direction,
      duration_minutes: tc.duration_minutes,
      seedOffset:       i * 10,
    });
  });

  return { spotId, tours, trails };
}

// ── Tour builder (shared with procedural mock) ────────────────────────────────

interface TourBuildParams {
  id:               string;
  spotId:           string;
  name:             string;
  trailSequence:    MtbTrail[];
  base:             [number, number, number];
  direction:        'cw' | 'ccw';
  duration_minutes: number;
  seedOffset:       number;
}

interface TourFromGpxParams {
  id:               string;
  spotId:           string;
  name:             string;
  trailSequence:    MtbTrail[];
  direction:        'cw' | 'ccw';
  duration_minutes: number;
  gpx:              string;
}

/** Build a tour from a real recorded GPX. Trail segments are overlaid from individual trail GPX. */
export function buildTourFromGpx(p: TourFromGpxParams): MtbTour {
  const gpxPoints = parseGpx(p.gpx);
  const profile   = toProfile(gpxPoints);

  // Segments are trail-type only — the gray background line comes from the full gpxPoints
  const segments: TourSegment[] = p.trailSequence.map(trail => ({
    type:       'trail' as const,
    trailId:    trail.id,
    difficulty: trail.difficulty,
    name:       trail.name,
    gpxPoints:  trail.gpxPoints,
  }));

  return {
    id:               p.id,
    spotId:           p.spotId,
    name:             p.name,
    distance_km:      Math.round((profile[profile.length - 1]?.dist ?? 0) * 10) / 10,
    elevation_gain:   calcGain(profile),
    elevation_loss:   calcLoss(profile),
    direction:        p.direction,
    duration_minutes: p.duration_minutes,
    trailCount:       p.trailSequence.length,
    segments,
    gpxPoints,
    elevationProfile: profile,
    hasFullGpx:       true,
  };
}

export function buildTour(p: TourBuildParams): MtbTour {
  const segments: TourSegment[] = [];
  let cursor: [number, number, number] = p.base;
  let seed = p.seedOffset;

  // Deduplicate consecutive same-trail repeats
  const unique: MtbTrail[] = [];
  for (const tr of p.trailSequence) {
    if (!unique.length || unique[unique.length - 1].id !== tr.id)
      unique.push(tr);
  }

  for (const trail of unique) {
    const trailStart = trail.gpxPoints[0];
    const trailEnd   = trail.gpxPoints[trail.gpxPoints.length - 1];

    segments.push({ type: 'transfer', gpxPoints: generateTransfer(cursor, trailStart, seed++) });
    segments.push({
      type:       'trail',
      trailId:    trail.id,
      difficulty: trail.difficulty,
      name:       trail.name,
      gpxPoints:  trail.gpxPoints,
    });

    cursor = trailEnd;
  }

  // Return transfer
  segments.push({ type: 'transfer', gpxPoints: generateTransfer(cursor, p.base, seed) });

  const allPts  = segments.flatMap(s => s.gpxPoints);
  const profile = toProfile(allPts);

  return {
    id:               p.id,
    spotId:           p.spotId,
    name:             p.name,
    distance_km:      Math.round((profile[profile.length - 1]?.dist ?? 0) * 10) / 10,
    elevation_gain:   calcGain(profile),
    elevation_loss:   calcLoss(profile),
    direction:        p.direction,
    duration_minutes: p.duration_minutes,
    trailCount:       unique.length,
    segments,
    gpxPoints:        allPts,
    elevationProfile: profile,
    hasFullGpx:       false,
  };
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** Smooth connector between two GPS points — simulates a firetrack/road climb */
function generateTransfer(
  from: [number, number, number],
  to:   [number, number, number],
  seed: number,
): [number, number, number][] {
  const n = 12;
  return Array.from({ length: n }, (_, i) => {
    const t   = i / (n - 1);
    const lat = from[0] + (to[0] - from[0]) * t + vary(seed + 10, t * 4) * 0.0006;
    const lng = from[1] + (to[1] - from[1]) * t + vary(seed + 11, t * 4) * 0.0006;
    const alt = from[2] + (to[2] - from[2]) * t;
    return [lat, lng, Math.round(alt)] as [number, number, number];
  });
}

function vary(seed: number, t: number): number {
  return Math.sin(seed * 7.3 + t * 13.7) * Math.cos(seed * 3.1 + t * 5.9);
}

export function toProfile(pts: [number, number, number][]): ElevationPoint[] {
  let dist = 0;
  return pts.map((p, i) => {
    if (i > 0) {
      const prev = pts[i - 1];
      const dlat = (p[0] - prev[0]) * 111_000;
      const dlng = (p[1] - prev[1]) * 111_000 * Math.cos(p[0] * Math.PI / 180);
      dist += Math.hypot(dlat, dlng) / 1000;
    }
    return { dist: Math.round(dist * 100) / 100, alt: p[2] };
  });
}

export function calcGain(profile: ElevationPoint[]): number {
  return Math.round(profile.reduce((s, p, i) =>
    i > 0 ? s + Math.max(0, p.alt - profile[i - 1].alt) : s, 0));
}

export function calcLoss(profile: ElevationPoint[]): number {
  return Math.round(profile.reduce((s, p, i) =>
    i > 0 ? s + Math.max(0, profile[i - 1].alt - p.alt) : s, 0));
}
