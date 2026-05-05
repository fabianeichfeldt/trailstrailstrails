import L from 'leaflet';
import { SpotMtbData, TourSegment } from '../../types/MtbTypes';
import { IMBA } from './elevationSvg';

export function drawTrailPolylines(
  data: SpotMtbData,
  overlayLayer: L.LayerGroup,
  polylineMap: Map<string, L.Polyline>,
): void {
  overlayLayer.clearLayers();
  polylineMap.clear();

  for (const trail of data.trails) {
    const latlngs  = trail.gpxPoints.map(p => [p[0], p[1]] as [number, number]);
    const color    = IMBA[trail.difficulty].hex;
    const directed = trail.direction !== 'both';
    const reversed = trail.direction === 'ccw';

    const pl = L.polyline(latlngs, {
      color,
      weight: 3,
      opacity: 0.65,
      className: directed ? (reversed ? 'trail-line-reversed' : 'trail-line-directed') : '',
    }).addTo(overlayLayer);

    if (directed && latlngs.length >= 2)
      addDirectionMarker(latlngs, color, reversed, overlayLayer);

    polylineMap.set(trail.id, pl);
  }
}

function addDirectionMarker(
  pts: [number, number][],
  color: string,
  reverse: boolean,
  overlayLayer: L.LayerGroup,
): void {
  const idx = Math.max(1, Math.floor(pts.length * 0.2));
  const [lat1, lng1] = pts[idx - 1];
  const [lat2, lng2] = pts[idx];
  const dy = lat2 - lat1;
  const dx = (lng2 - lng1) * Math.cos(lat1 * Math.PI / 180);
  const bearing = Math.atan2(dx, dy) * 180 / Math.PI + (reverse ? 180 : 0);

  const icon = L.divIcon({
    html: `<div style="transform:rotate(${bearing}deg);color:${color};font-size:13px;line-height:1;filter:drop-shadow(0 0 1px #fff)">▲</div>`,
    className: 'trail-arrow-icon',
    iconSize: [13, 13],
    iconAnchor: [6.5, 6.5],
  });

  L.marker([(lat1 + lat2) / 2, (lng1 + lng2) / 2], { icon, interactive: false, keyboard: false })
    .addTo(overlayLayer);
}

export function addSegmentLabel(
  seg: TourSegment,
  latlngs: [number, number][],
  map: L.Map,
  tourLayers: L.Layer[],
): void {
  if (!seg.difficulty) return;
  const mid   = latlngs[Math.floor(latlngs.length / 2)];
  const color = IMBA[seg.difficulty].hex;
  const icon  = L.divIcon({
    html: `<div class="seg-label" style="border-color:${color};color:${color}">${seg.name ?? ''}</div>`,
    className: '',
    iconAnchor: [0, 0],
  });
  tourLayers.push(L.marker(mid, { icon, interactive: false, keyboard: false }).addTo(map));
}
