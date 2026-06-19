import L from 'leaflet';
import { GpxTrailRow, GpxTourRow } from './Api';
import { DIFF_COLOR } from './GpxProcessor';
import type { GpxPoint } from './GpxProcessor';
import { elevationSVG, bindElevationHover } from '../map/spot_panel/elevationSvg';
import { ElevationPoint } from '../types/MtbTypes';

export interface MapViewLike {
  clear(): void;
  addTrailPolyline(t: GpxTrailRow): void;
  addTourPolyline(t: GpxTourRow): void;
  addPendingPolyline(key: string, gpxPoints: [number, number, number][], color?: string): void;
  updatePendingColor(key: string, color: string): void;
  removeLayer(id: string): void;
  highlight(id: string): void;
  resetHighlights(): void;
  fitTo(id: string): void;
  fitAll(): void;
  setClickHandler(fn: (id: string) => void): void;
  invalidate(): void;
  showSourceTrack(points: GpxPoint[]): void;
  clearSourceTrack(): void;
  updateLiveSlice(points: GpxPoint[], color: string): void;
  clearLiveSlice(): void;
  addSegmentPolyline(key: string, points: GpxPoint[], color: string): void;
}

const PENDING_COLOR = '#999';

export class MapView {
  private map: L.Map;
  private layers = new Map<string, L.Polyline>();
  private hoverMarker: L.CircleMarker | null = null;
  private onPolylineClick?: (id: string) => void;
  private sourceTrack: L.Polyline | null = null;
  private liveSlice: L.Polyline | null = null;

  constructor(container: HTMLElement) {
    this.map = L.map(container, { zoomControl: true });
    L.tileLayer('https://tile.tracestrack.com/topo__/{z}/{x}/{y}.webp?key=4380ddf8c7e3d985c0835d43bb748130&style=contrast-', {
      attribution: '© Tracestrack | © OpenStreetMap contributors',
      maxZoom: 17,
    }).addTo(this.map);
    this.map.setView([51.0, 10.5], 6);
  }

  setClickHandler(fn: (id: string) => void) {
    this.onPolylineClick = fn;
  }

  showTrails(trails: GpxTrailRow[]) {
    for (const t of trails) this.addTrailPolyline(t);
    this.fitAll();
  }

  addTrailPolyline(t: GpxTrailRow) {
    this.removeLayer(t.id);
    const color = DIFF_COLOR[t.difficulty as keyof typeof DIFF_COLOR] ?? '#888';
    const latlngs = t.gpx_points.map(p => [p[0], p[1]] as [number, number]);
    const pl = L.polyline(latlngs, { color, weight: 4, opacity: 0.85 }).addTo(this.map);
    pl.on('click', () => this.onPolylineClick?.(t.id));
    pl.bindTooltip(t.name, { sticky: true, className: 'sm-map-tooltip' });
    this.layers.set(t.id, pl);
  }

  addTourPolyline(t: GpxTourRow) {
    this.removeLayer(t.id);
    const latlngs = t.gpx_points.map(p => [p[0], p[1]] as [number, number]);
    const pl = L.polyline(latlngs, { color: '#333', weight: 3, opacity: 0.7, dashArray: '6 4' }).addTo(this.map);
    pl.on('click', () => this.onPolylineClick?.(t.id));
    pl.bindTooltip(t.name, { sticky: true, className: 'sm-map-tooltip' });
    this.layers.set(t.id, pl);
  }

  addPendingPolyline(key: string, gpxPoints: [number, number, number][], color = PENDING_COLOR) {
    this.removeLayer(key);
    const latlngs = gpxPoints.map(p => [p[0], p[1]] as [number, number]);
    const pl = L.polyline(latlngs, { color, weight: 3, opacity: 0.8, dashArray: '4 3' }).addTo(this.map);
    this.layers.set(key, pl);
    return pl;
  }

  updatePendingColor(key: string, color: string) {
    this.layers.get(key)?.setStyle({ color });
  }

  removeLayer(id: string) {
    const pl = this.layers.get(id);
    if (pl) { this.map.removeLayer(pl); this.layers.delete(id); }
  }

  highlight(id: string) {
    this.layers.forEach((pl, lid) => {
      pl.setStyle(lid === id ? { weight: 6, opacity: 1 } : { weight: 3, opacity: 0.45 });
      if (lid === id) pl.bringToFront();
    });
  }

  resetHighlights() {
    this.layers.forEach(pl => pl.setStyle({ weight: 4, opacity: 0.85 }));
  }

  fitTo(id: string) {
    const pl = this.layers.get(id);
    if (pl) this.map.fitBounds(pl.getBounds(), { padding: [50, 50], maxZoom: 15, animate: true });
  }

  fitAll() {
    const all: L.LatLngBounds[] = [];
    this.layers.forEach(pl => all.push(pl.getBounds()));
    if (all.length === 0) return;
    const bounds = all.reduce((acc, b) => acc.extend(b));
    this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }

  setHoverMarker(latlng: [number, number], color: string) {
    if (!this.hoverMarker) {
      this.hoverMarker = L.circleMarker(latlng, {
        radius: 7, color, weight: 2.5, fillColor: '#fff', fillOpacity: 1, interactive: false,
      }).addTo(this.map);
    } else {
      this.hoverMarker.setLatLng(latlng);
      this.hoverMarker.setStyle({ color });
    }
  }

  removeHoverMarker() {
    if (this.hoverMarker) { this.map.removeLayer(this.hoverMarker); this.hoverMarker = null; }
  }

  showSourceTrack(points: GpxPoint[]) {
    if (this.sourceTrack) { this.map.removeLayer(this.sourceTrack); }
    const latlngs = points.map(p => [p.lat, p.lng] as [number, number]);
    this.sourceTrack = L.polyline(latlngs, { color: '#888', weight: 3, opacity: 0.6, interactive: false }).addTo(this.map);
    this.map.fitBounds(this.sourceTrack.getBounds(), { padding: [40, 40], maxZoom: 15 });
  }

  clearSourceTrack() {
    if (this.sourceTrack) { this.map.removeLayer(this.sourceTrack); this.sourceTrack = null; }
  }

  updateLiveSlice(points: GpxPoint[], color: string) {
    const latlngs = points.map(p => [p.lat, p.lng] as [number, number]);
    if (!this.liveSlice) {
      this.liveSlice = L.polyline(latlngs, { color, weight: 4, opacity: 0.9, interactive: false }).addTo(this.map);
    } else {
      this.liveSlice.setLatLngs(latlngs);
      this.liveSlice.setStyle({ color });
    }
    this.liveSlice.bringToFront();
  }

  clearLiveSlice() {
    if (this.liveSlice) { this.map.removeLayer(this.liveSlice); this.liveSlice = null; }
  }

  addSegmentPolyline(key: string, points: GpxPoint[], color: string) {
    this.removeLayer(key);
    const latlngs = points.map(p => [p.lat, p.lng] as [number, number]);
    const pl = L.polyline(latlngs, { color, weight: 3.5, opacity: 0.9 }).addTo(this.map);
    this.layers.set(key, pl);
  }

  clear() {
    this.layers.forEach(pl => this.map.removeLayer(pl));
    this.layers.clear();
    this.removeHoverMarker();
    this.clearSourceTrack();
    this.clearLiveSlice();
  }

  invalidate() {
    this.map.invalidateSize();
  }
}

// ── Elevation panel helpers ────────────────────────────────────────────────────

export interface ElevItem {
  name: string;
  gpxPoints: [number, number, number][];
  elevationProfile: ElevationPoint[];
  distance_km: number;
  elevation_gain: number;
  elevation_loss: number;
  direction: string;
  difficulty?: string;
  gpx_url?: string;
}

export function renderElevation(panel: HTMLElement, item: ElevItem, mapView: MapView): void {
  const fakeItem = {
    id: '',
    spotId: '',
    name: item.name,
    gpxPoints: item.gpxPoints,
    elevationProfile: item.elevationProfile,
    distance_km: item.distance_km,
    elevation_gain: item.elevation_gain,
    elevation_loss: item.elevation_loss,
    direction: item.direction as any,
    difficulty: (item.difficulty ?? 'blue') as any,
    trailCount: 0,
    segments: [],
    hasFullGpx: true,
    duration_minutes: 0,
  };

  const dirLabels: Record<string, string> = {
    'cw': '↻ Uhrzeigersinn', 'ccw': '↺ Gegen Uhrzeiger',
    'one-way-down': '⤵ Bergab', 'one-way-up': '⤴ Bergauf', 'both': '↔ Beide',
  };

  panel.querySelector('.sm-elev-name')!.textContent = item.name;
  panel.querySelector('.sm-elev-chart')!.innerHTML = elevationSVG(item.elevationProfile, fakeItem);
  panel.querySelector('.sm-elev-stats')!.innerHTML =
    `<span>📍 ${item.distance_km} km</span>` +
    `<span>↑ ${item.elevation_gain} m</span>` +
    `<span>↓ ${item.elevation_loss} m</span>` +
    `<span>${dirLabels[item.direction] ?? item.direction}</span>`;

  const dl = panel.querySelector('.sm-elev-dl') as HTMLAnchorElement;
  if (item.gpx_url) {
    dl.href = item.gpx_url;
    dl.download = `${item.name}.gpx`;
    dl.classList.remove('hidden');
  } else {
    dl.classList.add('hidden');
  }

  panel.classList.remove('hidden');

  requestAnimationFrame(() => {
    const svg = panel.querySelector('.sm-elev-chart svg') as SVGSVGElement | null;
    if (!svg) return;
    bindElevationHover(svg, fakeItem,
      (ll, color) => mapView.setHoverMarker(ll, color),
      () => mapView.removeHoverMarker(),
    );
  });
}
