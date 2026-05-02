/**
 * Returns SpotMtbData for a given spot.
 * Priority: real data registered in spotData.ts → procedural fallback.
 *
 * To add real data for a spot, edit spotData.ts.
 */
import { SpotMtbData, MtbTrail, ImbaColor, TrailDirection } from '../types/MtbTypes';
import { getRegisteredData, buildTour, toProfile, calcGain, calcLoss } from './spotBuilder';

// Side-effect import: runs all registerSpot() calls in spotData.ts
import './spotData';

// ── Procedural fallback ───────────────────────────────────────────────────────

function vary(seed: number, t: number): number {
  return Math.sin(seed * 7.3 + t * 13.7) * Math.cos(seed * 3.1 + t * 5.9);
}

function generateDescentPoints(
  lat: number, lng: number, lengthKm: number, seed: number,
): [number, number, number][] {
  const n = Math.max(25, Math.floor(lengthKm * 22));
  const offLat = 0.007 * lengthKm + vary(seed, 0) * 0.002;
  const offLng = 0.004 * lengthKm + vary(seed, 1) * 0.003;
  const startAlt = 420 + seed * 35 + vary(seed, 2) * 20;
  const endAlt   = startAlt - lengthKm * 75 + vary(seed, 3) * 15;

  return Array.from({ length: n }, (_, i) => {
    const t    = i / (n - 1);
    const pLat = lat + offLat * (1 - t) * 0.14 - t * 0.004 + vary(seed, t * 4) * 0.001;
    const pLng = lng + offLng * (1 - t) * 0.14
      + Math.sin(t * Math.PI * (3 + (seed % 3))) * 0.004 * lengthKm
      + vary(seed, t * 5) * 0.001;
    const pAlt = startAlt + (endAlt - startAlt) * t
      + 12 * Math.sin(t * Math.PI * 6 + seed)
      + vary(seed, t * 10) * 5;
    return [pLat, pLng, Math.round(pAlt)] as [number, number, number];
  });
}

function generateLoopPoints(
  lat: number, lng: number, radiusKm: number, seed: number,
): [number, number, number][] {
  const n = Math.max(30, Math.floor(radiusKm * 2 * Math.PI * 15));
  const r = radiusKm * 0.009;
  const startAlt = 310 + seed * 12;

  return Array.from({ length: n + 1 }, (_, i) => {
    const t     = i / n;
    const angle = t * 2 * Math.PI + seed * 0.8;
    const rVar  = r * (1 + 0.25 * Math.sin(angle * 2 + seed) + 0.1 * Math.sin(angle * 5));
    const pLat  = lat + rVar * Math.cos(angle) + vary(seed, t) * r * 0.1;
    const pLng  = lng + rVar * 1.35 * Math.sin(angle) + vary(seed, t + 1) * r * 0.1;
    const pAlt  = startAlt + 55 * Math.sin(angle * 2) + 25 * Math.sin(angle * 3 + seed) + vary(seed, t * 8) * 8;
    return [pLat, pLng, Math.round(pAlt)] as [number, number, number];
  });
}

const TRAIL_DEFS: {
  key: string; name: string; difficulty: ImbaColor;
  direction: TrailDirection; type: 'descent' | 'loop'; lengthKm: number;
}[] = [
  { key: 'flow',   name: 'Flowtrail Süd',       difficulty: 'blue',  direction: 'one-way-down', type: 'descent', lengthKm: 1.4 },
  { key: 'tech',   name: 'Tech Rock Section',   difficulty: 'red',   direction: 'one-way-down', type: 'descent', lengthKm: 0.9 },
  { key: 'pump',   name: 'Pumptrack Verbinder', difficulty: 'green', direction: 'both',         type: 'loop',    lengthKm: 0.5 },
  { key: 'enduro', name: 'Enduro Drop-Line',    difficulty: 'black', direction: 'one-way-down', type: 'descent', lengthKm: 1.1 },
];

function buildProceduralData(spotId: string, lat: number, lng: number): SpotMtbData {
  const trails: MtbTrail[] = TRAIL_DEFS.map((def, i) => {
    const pts = def.type === 'descent'
      ? generateDescentPoints(lat, lng, def.lengthKm, i + 1)
      : generateLoopPoints(lat, lng, def.lengthKm * 0.5, i + 1);
    const profile = toProfile(pts);
    return {
      id:               `${spotId}-trail-${def.key}`,
      spotId,
      name:             def.name,
      difficulty:       def.difficulty,
      distance_km:      Math.round((profile[profile.length - 1]?.dist ?? def.lengthKm) * 10) / 10,
      elevation_gain:   calcGain(profile),
      elevation_loss:   calcLoss(profile),
      direction:        def.direction,
      gpxPoints:        pts,
      elevationProfile: profile,
    };
  });

  const t = (key: string) => trails.find(tr => tr.id === `${spotId}-trail-${key}`)!;
  const base: [number, number, number] = [lat - 0.004, lng + 0.001, 310];

  const tours = [
    buildTour({ id: `${spotId}-tour-0`, spotId, name: 'Klassiker-Tour',
      trailSequence: [t('flow'), t('pump')], base, direction: 'cw',  duration_minutes: 90,  seedOffset: 20 }),
    buildTour({ id: `${spotId}-tour-1`, spotId, name: 'Enduro-Runde',
      trailSequence: [t('tech'), t('enduro'), t('flow')], base, direction: 'ccw', duration_minutes: 150, seedOffset: 30 }),
  ];

  return { spotId, tours, trails };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getMockSpotData(spotId: string, lat: number, lng: number): SpotMtbData {
  return getRegisteredData(spotId) ?? buildProceduralData(spotId, lat, lng);
}
