import L from 'leaflet';
import { GpxTrailRow, GpxTourRow } from './Api';
import { DIFF_COLOR } from './GpxProcessor';
import type { GpxPoint } from './GpxProcessor';
import { markerIconOptions, parkingIconOptions } from '../map/markerIcon';
import { roundCoord, type LatLng } from './coords';

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
  flyTo(lat: number, lng: number, zoom: number): void;
  showSpotMarker(lat: number, lng: number, approved: boolean): void;
  setClickHandler(fn: (id: string) => void): void;
  invalidate(): void;
  showSourceTrack(points: GpxPoint[]): void;
  clearSourceTrack(): void;
  updateLiveSlice(points: GpxPoint[], color: string): void;
  clearLiveSlice(): void;
  addSegmentPolyline(key: string, points: GpxPoint[], color: string): void;
  enablePointPicker(initial: LatLng | null, onPick: (pos: LatLng) => void): void;
  disablePointPicker(): void;
}

const PENDING_COLOR = '#999';

export class MapView {
  private map: L.Map;
  private layers = new Map<string, L.Polyline>();
  private spotMarker: L.Marker | null = null;
  private onPolylineClick?: (id: string) => void;
  private sourceTrack: L.Polyline | null = null;
  private liveSlice: L.Polyline | null = null;
  private pointPickerMarker: L.Marker | null = null;
  private pointPickerCallback: ((pos: LatLng) => void) | null = null;
  private pointPickerClickHandler = (e: L.LeafletMouseEvent) => {
    const pos = { lat: roundCoord(e.latlng.lat), lng: roundCoord(e.latlng.lng) };
    this.placePointPickerMarker(pos);
    this.pointPickerCallback?.(pos);
  };

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

  flyTo(lat: number, lng: number, zoom: number) {
    this.map.flyTo([lat, lng], zoom, { duration: 0.5 });
  }

  showSpotMarker(lat: number, lng: number, approved: boolean) {
    this.spotMarker?.remove();
    this.spotMarker = L.marker([lat, lng], {
      icon: L.divIcon(markerIconOptions('trail', approved)),
      interactive: false,
    }).addTo(this.map);
  }

  fitAll() {
    const all: L.LatLngBounds[] = [];
    this.layers.forEach(pl => all.push(pl.getBounds()));
    if (all.length === 0) return;
    const bounds = all.reduce((acc, b) => acc.extend(b));
    this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
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

  /** Click-to-place (and drag-to-adjust) a single marker, for the parking-lot editor. */
  enablePointPicker(initial: LatLng | null, onPick: (pos: LatLng) => void) {
    this.disablePointPicker();
    this.pointPickerCallback = onPick;
    if (initial) {
      this.placePointPickerMarker(initial);
      this.map.setView([initial.lat, initial.lng], Math.max(this.map.getZoom(), 14));
    }
    this.map.on('click', this.pointPickerClickHandler);
  }

  disablePointPicker() {
    this.map.off('click', this.pointPickerClickHandler);
    if (this.pointPickerMarker) { this.map.removeLayer(this.pointPickerMarker); this.pointPickerMarker = null; }
    this.pointPickerCallback = null;
  }

  private placePointPickerMarker(pos: LatLng) {
    if (!this.pointPickerMarker) {
      this.pointPickerMarker = L.marker([pos.lat, pos.lng], {
        icon: L.divIcon(parkingIconOptions()),
        draggable: true,
      }).addTo(this.map);
      this.pointPickerMarker.on('dragend', () => {
        const ll = this.pointPickerMarker!.getLatLng();
        const pos2 = { lat: roundCoord(ll.lat), lng: roundCoord(ll.lng) };
        this.pointPickerMarker!.setLatLng([pos2.lat, pos2.lng]);
        this.pointPickerCallback?.(pos2);
      });
    } else {
      this.pointPickerMarker.setLatLng([pos.lat, pos.lng]);
    }
  }

  clear() {
    this.layers.forEach(pl => this.map.removeLayer(pl));
    this.layers.clear();
    this.spotMarker?.remove();
    this.spotMarker = null;
    this.clearSourceTrack();
    this.clearLiveSlice();
    this.disablePointPicker();
  }

  invalidate() {
    this.map.invalidateSize();
  }
}
