import { ElevationPoint, ImbaColor, TrailDirection } from '../types/MtbTypes';

export interface GpxPoint {
  lat: number;
  lng: number;
  alt: number;
  time: Date | null;
}

export interface ProcessedGpx {
  suggestedName: string;
  rawPoints: GpxPoint[];
  gpxPoints: [number, number, number][];
  elevationProfile: ElevationPoint[];
  distance_km: number;
  elevation_gain: number;
  elevation_loss: number;
  duration_minutes: number | null;
  rawCount: number;
  thinnedCount: number;
  gpxContent: string;
}

const EPSILON_M = 0.5;

function parseGpx(content: string): { name: string; points: GpxPoint[] } {
  const nameMatch = content.match(/<name>([^<]*)<\/name>/);
  const name = nameMatch ? nameMatch[1].trim() : '';
  const points: GpxPoint[] = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const latM = m[1].match(/lat="([^"]+)"/);
    const lonM = m[1].match(/lon="([^"]+)"/);
    if (!latM || !lonM) continue;
    const eleM  = m[2].match(/<ele>([^<]+)<\/ele>/);
    const timeM = m[2].match(/<time>([^<]+)<\/time>/);
    points.push({
      lat:  parseFloat(latM[1]),
      lng:  parseFloat(lonM[1]),
      alt:  eleM ? parseFloat(eleM[1]) : 0,
      time: timeM ? new Date(timeM[1]) : null,
    });
  }
  return { name, points };
}

function smoothElevation(points: GpxPoint[], window = 5): GpxPoint[] {
  const half = Math.floor(window / 2);
  return points.map((p, i) => {
    const s = Math.max(0, i - half);
    const e = Math.min(points.length - 1, i + half);
    let sum = 0;
    for (let j = s; j <= e; j++) sum += points[j].alt;
    return { ...p, alt: Math.round(sum / (e - s + 1)) };
  });
}

function perpDistMeters(p: GpxPoint, a: GpxPoint, b: GpxPoint): number {
  const cos = Math.cos(a.lat * Math.PI / 180);
  const px = (p.lng - a.lng) * 111000 * cos;
  const py = (p.lat - a.lat) * 111000;
  const dx = (b.lng - a.lng) * 111000 * cos;
  const dy = (b.lat - a.lat) * 111000;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  return Math.hypot(px - t * dx, py - t * dy);
}

function rdp(points: GpxPoint[], epsilon: number): GpxPoint[] {
  if (points.length <= 2) return points;
  let maxD = 0, maxI = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const d = perpDistMeters(points[i], points[0], points[last]);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > epsilon) {
    const L = rdp(points.slice(0, maxI + 1), epsilon);
    const R = rdp(points.slice(maxI), epsilon);
    return L.slice(0, -1).concat(R);
  }
  return [points[0], points[last]];
}

function computeStats(points: GpxPoint[]): {
  distance_km: number;
  elevation_gain: number;
  elevation_loss: number;
  duration_minutes: number | null;
} {
  let distM = 0, gain = 0, loss = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dlat = (b.lat - a.lat) * 111000;
    const dlng = (b.lng - a.lng) * 111000 * Math.cos(b.lat * Math.PI / 180);
    distM += Math.hypot(dlat, dlng);
    const dAlt = b.alt - a.alt;
    if (dAlt > 0) gain += dAlt; else loss += -dAlt;
  }
  const t0 = points.find(p => p.time)?.time;
  const tN = [...points].reverse().find(p => p.time)?.time;
  const duration_minutes = t0 && tN ? Math.round((tN.getTime() - t0.getTime()) / 60000) : null;
  return {
    distance_km:    Math.round(distM / 100) / 10,
    elevation_gain: Math.round(gain),
    elevation_loss: Math.round(loss),
    duration_minutes,
  };
}

export function toElevationProfile(points: [number, number, number][]): ElevationPoint[] {
  if (points.length === 0) return [];
  let cum = 0;
  return points.map((p, i) => {
    if (i > 0) {
      const dlat = (p[0] - points[i - 1][0]) * 111000;
      const dlng = (p[1] - points[i - 1][1]) * 111000 * Math.cos(p[0] * Math.PI / 180);
      cum += Math.hypot(dlat, dlng) / 1000;
    }
    return { dist: Math.round(cum * 10) / 10, alt: p[2] };
  });
}

function latLngDist(p1: GpxPoint, p2: GpxPoint): number {
  const dlat = (p2.lat - p1.lat) * 111000;
  const dlng = (p2.lng - p1.lng) * 111000 * Math.cos(p1.lat * Math.PI / 180);
  return Math.hypot(dlat, dlng);
}

function frechet(c1: GpxPoint[], c2: GpxPoint[]): number {
  if (!c1.length || !c2.length) return Infinity;
  const memo = new Map<string, number>();
  function fd(i: number, j: number): number {
    if (i === 0 && j === 0) return latLngDist(c1[0], c2[0]);
    if (i === 0 || j === 0) return Infinity;
    const key = `${i},${j}`;
    if (memo.has(key)) return memo.get(key)!;
    const d = Math.max(latLngDist(c1[i], c2[j]), Math.min(fd(i - 1, j), fd(i, j - 1), fd(i - 1, j - 1)));
    memo.set(key, d);
    return d;
  }
  return fd(c1.length - 1, c2.length - 1);
}

export function matchTrailsInTour(
  tourRaw: GpxPoint[],
  trails: Array<{ name: string; rawPoints: GpxPoint[] }>,
): string[] {
  const MAX_D = 100;
  const matches: Array<{ name: string; startIdx: number }> = [];

  for (let start = 0; start < tourRaw.length; start++) {
    for (const trail of trails) {
      if (matches.some(m => m.name === trail.name)) continue;
      const tp = trail.rawPoints;
      if (tp.length < 3) continue;
      for (let ws = tp.length; ws <= Math.min(tp.length + 20, tourRaw.length - start); ws++) {
        if (start + ws > tourRaw.length) break;
        if (frechet(tp, tourRaw.slice(start, start + ws)) < MAX_D) {
          matches.push({ name: trail.name, startIdx: start });
          break;
        }
      }
    }
  }

  matches.sort((a, b) => a.startIdx - b.startIdx);
  const seen = new Set<string>();
  return matches.filter(m => {
    if (seen.has(m.name)) return false;
    seen.add(m.name);
    return true;
  }).map(m => m.name);
}

function buildGpxXml(points: GpxPoint[]): string {
  const trkpts = points.map(p => {
    const time = p.time ? `\n        <time>${p.time.toISOString()}</time>` : '';
    return `      <trkpt lat="${p.lat}" lon="${p.lng}"><ele>${p.alt}</ele>${time}</trkpt>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailRadar">
  <trk>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export interface SegmentResult {
  rawPoints: GpxPoint[];
  gpxPoints: [number, number, number][];
  elevationProfile: ElevationPoint[];
  distance_km: number;
  elevation_gain: number;
  elevation_loss: number;
  duration_minutes: number | null;
  rawCount: number;
  thinnedCount: number;
  gpxContent: string;
}

export function processSegment(rawPoints: GpxPoint[], startIdx: number, endIdx: number): SegmentResult | null {
  const slice = rawPoints.slice(startIdx, endIdx + 1);
  if (slice.length === 0) return null;
  const smoothed = smoothElevation(slice);
  const thinned  = rdp(smoothed, EPSILON_M);
  const stats    = computeStats(thinned);
  const gpxPoints = thinned.map(p => [
    Math.round(p.lat * 1e6) / 1e6,
    Math.round(p.lng * 1e6) / 1e6,
    p.alt,
  ] as [number, number, number]);
  return {
    rawPoints:        slice,
    gpxPoints,
    elevationProfile: toElevationProfile(gpxPoints),
    ...stats,
    rawCount:     slice.length,
    thinnedCount: thinned.length,
    gpxContent:   buildGpxXml(thinned),
  };
}

export function processGpx(content: string): ProcessedGpx | null {
  const { name, points } = parseGpx(content);
  if (points.length === 0) return null;
  const smoothed = smoothElevation(points);
  const thinned  = rdp(smoothed, EPSILON_M);
  const stats    = computeStats(thinned);
  const gpxPoints = thinned.map(p => [
    Math.round(p.lat * 1e6) / 1e6,
    Math.round(p.lng * 1e6) / 1e6,
    p.alt,
  ] as [number, number, number]);
  return {
    suggestedName:    name,
    rawPoints:        points,
    gpxPoints,
    elevationProfile: toElevationProfile(gpxPoints),
    ...stats,
    rawCount:     points.length,
    thinnedCount: thinned.length,
    gpxContent:   content,
  };
}

export const DIFFICULTIES: Array<{ value: ImbaColor; label: string; color: string }> = [
  { value: 'green',        label: 'Grün · Einsteiger',     color: '#2e7d32' },
  { value: 'blue',         label: 'Blau · Fortgeschritten', color: '#1565c0' },
  { value: 'red',          label: 'Rot · Schwierig',        color: '#c62828' },
  { value: 'black',        label: 'Schwarz · Experte',      color: '#111111' },
  { value: 'double-black', label: '⚫⚫ Extrem',             color: '#000000' },
];

export const DIRECTIONS: Array<{ value: TrailDirection; label: string }> = [
  { value: 'one-way-down', label: '⤵ Nur bergab'         },
  { value: 'one-way-up',   label: '⤴ Nur bergauf'         },
  { value: 'both',         label: '↔ Beide Richtungen'    },
  { value: 'cw',           label: '↻ Uhrzeigersinn'       },
  { value: 'ccw',          label: '↺ Gegen Uhrzeiger'     },
];

export const DIFF_COLOR: Record<ImbaColor, string> = {
  'green':        '#2e7d32',
  'blue':         '#1565c0',
  'red':          '#c62828',
  'black':        '#111111',
  'double-black': '#000000',
};
