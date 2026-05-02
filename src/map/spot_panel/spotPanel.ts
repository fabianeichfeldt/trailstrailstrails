import L from 'leaflet';
import '@fortawesome/fontawesome-free/css/all.css';
import './spot_panel.css';
import { ElevationPoint, ImbaColor, MtbTour, MtbTrail, SpotMtbData, TourSegment, TrailDirection } from '../../types/MtbTypes';
import { SingleTrail, Trail, isBikePark, isDirtPark } from '../../types/Trail';
import { Auth } from '../../auth/auth';
import { getTrailDetails, getSpotGpxData } from '../../communication/trails';
import { renderTrailDetails } from '../detail_popup/detailsPopup';
import { bindPopupEvents, startPhotoCarousel } from '../detail_popup/logic';
import { setupYT2Click } from '../detail_popup/yt';
import { bindPhotoLightbox } from '../lightbox';
import { getMockSpotData } from '../../mock/mockSpotData';

// ── IMBA display metadata ────────────────────────────────────────────────────

const IMBA: Record<ImbaColor, { hex: string; label: string }> = {
  'green':        { hex: '#2e7d32', label: 'Grün · Einsteiger'    },
  'blue':         { hex: '#1565c0', label: 'Blau · Fortgeschritte' },
  'red':          { hex: '#c62828', label: 'Rot · Schwierig'       },
  'black':        { hex: '#111111', label: 'Schwarz · Experte'     },
  'double-black': { hex: '#000000', label: '⚫⚫ Extrem'            },
};

const DIR_LABEL: Record<TrailDirection, string> = {
  'cw':           '↻ Uhrzeigersinn',
  'ccw':          '↺ Gegen Uhrzeiger',
  'one-way-down': '⤵ Nur bergab',
  'one-way-up':   '⤴ Nur bergauf',
  'both':         '↔ Beide Richtungen',
};

type AnyItem = MtbTour | MtbTrail;

// ── SpotPanel ────────────────────────────────────────────────────────────────

export class SpotPanel {
  private panel!: HTMLElement;
  private overlayLayer: L.LayerGroup;       // individual trail polylines (always visible)
  private tourLayers: L.Layer[] = [];       // tour route layers — cleared when tour deselected
  private polylineMap = new Map<string, L.Polyline>(); // trailId → polyline
  private hoverMarker: L.CircleMarker | null = null;
  private activeId: string | null = null;
  private data: SpotMtbData | null = null;
  private currentItem: Trail | null = null;
  private infoLoaded = false;
  private onClose: () => void;
  private auth: Auth;

  constructor(private readonly map: L.Map, auth: Auth, onClose: () => void) {
    this.auth = auth;
    this.onClose = onClose;
    this.overlayLayer = L.layerGroup().addTo(map);
    this.buildDOM();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public open(item: Trail, fallbackData: SpotMtbData | null = null) {
    this.currentItem = item;
    this.infoLoaded = false;
    this.activeId = null;
    this.panel.querySelector('.spot-panel-title')!.textContent = item.name;
    this.closeElevation();
    this.panel.classList.add('open');
    this.updateTabsVisibility();
    this.activateTab('info');

    // For trails, fetch real GPX data from Supabase, fall back to mock data
    // For bikeparks/dirtparks, skip the trails/tours tabs
    if (fallbackData) {
      this.loadSpotData(item.id, fallbackData);
    }
  }

  private async loadSpotData(spotId: string, fallbackData: SpotMtbData) {
    try {
      const realData = await getSpotGpxData(spotId);
      this.data = realData || fallbackData;
    } catch (err) {
      console.warn('Failed to fetch spot GPX data, using fallback:', err);
      this.data = fallbackData;
    }

    if (!this.data) return;
    this.renderLists();
    this.drawPolylines(this.data);
  }

  public close() {
    this.panel.classList.remove('open');
    this.overlayLayer.clearLayers();
    this.clearTourLayers();
    this.polylineMap.clear();
    this.activeId = null;
    this.data = null;
    this.currentItem = null;
    this.infoLoaded = false;
    this.closeElevation();
    this.onClose();
  }

  public get isOpen() { return this.panel.classList.contains('open'); }

  // ── DOM construction ───────────────────────────────────────────────────────

  private buildDOM() {
    this.panel = document.createElement('div');
    this.panel.className = 'spot-panel';
    this.panel.innerHTML = `
      <div class="spot-panel-handle" role="presentation"></div>
      <div class="spot-panel-header">
        <div class="spot-panel-title"></div>
        <button class="spot-panel-close" aria-label="Schließen">✕</button>
      </div>
      <div class="spot-panel-tabs">
        <button class="spot-tab active" data-tab="info">Spot-Info</button>
        <button class="spot-tab" data-tab="tours">Touren</button>
        <button class="spot-tab" data-tab="trails">Trails</button>
      </div>
      <div class="spot-panel-body">
        <div class="spot-tab-content" id="spot-info-tab">
          <div class="spot-info-loading"><p>Lade Details …</p></div>
        </div>
        <div class="spot-tab-content hidden" id="spot-tours-tab"></div>
        <div class="spot-tab-content hidden" id="spot-trails-tab"></div>
      </div>
      <div class="spot-elevation-panel hidden">
        <div class="spot-elevation-header">
          <span class="spot-elevation-name"></span>
          <div class="spot-elevation-actions">
            <a class="spot-elevation-download hidden" download aria-label="GPX herunterladen"><i class="fas fa-download"></i></a>
            <button class="spot-elevation-close" aria-label="Höhenprofil schließen">✕</button>
          </div>
        </div>
        <div class="spot-elevation-chart"></div>
        <div class="spot-elevation-stats"></div>
      </div>
    `;

    // Must be inside the map container so it layers correctly
    this.map.getContainer().appendChild(this.panel);

    // Stop map interactions from firing through the panel
    L.DomEvent.disableClickPropagation(this.panel);
    L.DomEvent.disableScrollPropagation(this.panel);

    this.panel.querySelector('.spot-panel-close')!
      .addEventListener('click', () => this.close());
    this.panel.querySelector('.spot-elevation-close')!
      .addEventListener('click', () => this.closeElevation());
    this.panel.querySelectorAll('.spot-tab').forEach(btn =>
      btn.addEventListener('click', e => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as 'tours' | 'trails' | 'info';
        this.activateTab(tab);
      })
    );

    this.initDragHandle();
  }

  private initDragHandle() {
    const handle = this.panel.querySelector('.spot-panel-handle') as HTMLElement;
    let startY = 0;
    let startH = 0;

    handle.addEventListener('touchstart', e => {
      startY = e.touches[0].clientY;
      startH = this.panel.getBoundingClientRect().height;
      this.panel.style.transition = 'none';
    }, { passive: true });

    handle.addEventListener('touchmove', e => {
      const dy = startY - e.touches[0].clientY;
      const h = Math.max(200, Math.min(window.innerHeight * 0.85, startH + dy));
      this.panel.style.height = h + 'px';
    }, { passive: true });

    handle.addEventListener('touchend', () => {
      this.panel.style.transition = '';
    });
  }

  // ── Tabs & rendering ───────────────────────────────────────────────────────

  private activateTab(tab: 'tours' | 'trails' | 'info') {
    this.panel.querySelectorAll('.spot-tab').forEach(b => b.classList.remove('active'));
    this.panel.querySelector(`[data-tab="${tab}"]`)!.classList.add('active');
    this.panel.querySelectorAll('.spot-tab-content').forEach(c => c.classList.add('hidden'));
    this.panel.querySelector(`#spot-${tab}-tab`)!.classList.remove('hidden');
    this.closeElevation();
    if (tab === 'info' && !this.infoLoaded) this.loadInfo();
  }

  private updateTabsVisibility() {
    const isTrail = this.currentItem && this.currentItem.type === 'trail';
    const toursTab = this.panel.querySelector('[data-tab="tours"]') as HTMLElement;
    const trailsTab = this.panel.querySelector('[data-tab="trails"]') as HTMLElement;

    if (isTrail) {
      toursTab.style.display = 'block';
      trailsTab.style.display = 'block';
    } else {
      toursTab.style.display = 'none';
      trailsTab.style.display = 'none';
    }
  }

  private async loadInfo() {
    if (!this.currentItem) return;
    const item = this.currentItem;
    const container = this.panel.querySelector('#spot-info-tab')!;
    try {
      const details = await getTrailDetails(item);
      const html = await renderTrailDetails(item, details, this.auth);
      container.innerHTML = `<div class="spot-info-content">${html}</div>`;
      const content = container.querySelector('.spot-info-content') as HTMLElement;
      await bindPopupEvents(content, this.auth, async () => {
        const freshDetails = await getTrailDetails(item);
        content.innerHTML = await renderTrailDetails(item, freshDetails, this.auth);
        startPhotoCarousel(content);
        bindPhotoLightbox(content);
        setupYT2Click(content);
      });
      startPhotoCarousel(content);
      bindPhotoLightbox(content);
      setupYT2Click(content);
      this.infoLoaded = true;
    } catch {
      container.innerHTML = '<p class="spot-info-error">⚠️ Details derzeit nicht verfügbar.</p>';
    }
  }

  private renderLists() {
    if (!this.data) return;
    this.panel.querySelector('#spot-tours-tab')!.innerHTML = this.toursHTML(this.data.tours);
    this.panel.querySelector('#spot-trails-tab')!.innerHTML = this.trailsHTML(this.data.trails);
    this.bindItemClicks();
  }

  /** One colored dot per unique trail difficulty in the tour */
  private tourDifficultyDots(tour: MtbTour): string {
    const seen = new Set<ImbaColor>();
    return tour.segments
      .filter(s => s.type === 'trail' && s.difficulty)
      .flatMap(s => {
        const d = s.difficulty as ImbaColor;
        if (seen.has(d)) return [];
        seen.add(d);
        return [`<span class="imba-dot" style="background:${IMBA[d].hex}" title="${IMBA[d].label}"></span>`];
      }).join('');
  }

  private toursHTML(tours: MtbTour[]) {
    if (!tours.length) return '<p class="spot-empty">Keine Touren für diesen Spot.</p>';
    return tours.map(t => `
      <div class="spot-item" data-id="${t.id}" data-kind="tour">
        <div class="spot-item-left">
          <div class="imba-dots">${this.tourDifficultyDots(t)}</div>
          <div class="spot-item-info">
            <div class="spot-item-name">
              <strong>${t.name}</strong>
              ${t.gpx_url ? `<a class="spot-item-dl" href="${t.gpx_url}" download="${t.name}.gpx" aria-label="GPX herunterladen"><i class="fas fa-download"></i></a>` : ''}
            </div>
            <span class="spot-item-sub">${t.trailCount} Trails · ${t.duration_minutes} min</span>
          </div>
        </div>
        <div class="spot-item-right">
          <div class="spot-item-stats">
            <span>📍 ${t.distance_km} km</span>
            <span>↑${t.elevation_gain}m &nbsp;↓${t.elevation_loss}m</span>
            <span class="direction-tag">${DIR_LABEL[t.direction]}</span>
          </div>
          <span class="spot-item-arrow">›</span>
        </div>
      </div>`).join('');
  }

  private trailsHTML(trails: MtbTrail[]) {
    if (!trails.length) return '<p class="spot-empty">Keine Trails für diesen Spot.</p>';
    return trails.map(t => `
      <div class="spot-item" data-id="${t.id}" data-kind="trail">
        <div class="spot-item-left">
          <span class="imba-dot" style="background:${IMBA[t.difficulty].hex}" title="${IMBA[t.difficulty].label}"></span>
          <div class="spot-item-info">
            <div class="spot-item-name">
              <strong>${t.name}</strong>
              ${t.gpx_url ? `<a class="spot-item-dl" href="${t.gpx_url}" download="${t.name}.gpx" aria-label="GPX herunterladen"><i class="fas fa-download"></i></a>` : ''}
            </div>
            <span class="spot-item-sub">${IMBA[t.difficulty].label}</span>
          </div>
        </div>
        <div class="spot-item-right">
          <div class="spot-item-stats">
            <span>📍 ${t.distance_km} km</span>
            <span>↑${t.elevation_gain}m &nbsp;↓${t.elevation_loss}m</span>
            <span class="direction-tag">${DIR_LABEL[t.direction]}</span>
          </div>
          <span class="spot-item-arrow">›</span>
        </div>
      </div>`).join('');
  }

  private bindItemClicks() {
    this.panel.querySelectorAll('.spot-item').forEach(el => {
      el.addEventListener('click', () => {
        const id   = (el as HTMLElement).dataset.id!;
        const kind = (el as HTMLElement).dataset.kind as 'tour' | 'trail';
        this.selectItem(id, kind);
        this.panel.querySelectorAll('.spot-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
      });
    });
  }

  // ── Item selection ─────────────────────────────────────────────────────────

  private selectItem(id: string, kind: 'tour' | 'trail') {
    if (!this.data) return;
    if (kind === 'tour') {
      const tour = this.data.tours.find(t => t.id === id);
      if (tour) this.selectTour(tour);
    } else {
      const trail = this.data.trails.find(t => t.id === id);
      if (trail) this.selectTrail(trail);
    }
    this.activeId = id;
  }

  private selectTrail(trail: MtbTrail) {
    // Restore individual trail view, highlight selected
    this.clearTourLayers();
    this.polylineMap.forEach((pl, id) => {
      pl.setStyle(id === trail.id
        ? { weight: 6, opacity: 1}
        : { weight: 2, opacity: 0.7}
      );
    });
    const pl = this.polylineMap.get(trail.id);
    if (pl) this.map.fitBounds(pl.getBounds(), { padding: [60, 60], maxZoom: 15, animate: true });
    this.showElevation(trail, trail.elevationProfile);
  }

  private clearTourLayers() {
    this.tourLayers.forEach(l => this.map.removeLayer(l));
    this.tourLayers = [];
  }

  private selectTour(tour: MtbTour) {
    this.clearTourLayers();

    // Collect trail IDs that are part of this tour
    const tourTrailIds = new Set(tour.segments
      .filter(s => s.type === 'trail' && s.trailId)
      .map(s => s.trailId!));

    // Set trail visibility: highlight tour trails, fade/dash others
    this.polylineMap.forEach((pl, trailId) => {
      if (tourTrailIds.has(trailId)) {
        // Trail is part of this tour — keep normal style
        pl.setStyle({ weight: 3, opacity: 0.65});
      } else {
        pl.setStyle({ weight: 2, opacity: 0.65});
      }
    });

    const fullRoute = tour.gpxPoints.map(p => [p[0], p[1]] as [number, number]);

    // 1. Full route as single dark gray base line (added first = renders below)
    if (fullRoute.length) {
      const base = L.polyline(fullRoute, { color: '#333', weight: 5, opacity: 0.85 }).addTo(this.map);
      this.tourLayers.push(base);
    }

    // 2. Trail segments in IMBA colors on top (added after = renders above)
    for (const seg of tour.segments) {
      if (seg.type !== 'trail' || !seg.difficulty) continue;
      const latlngs = seg.gpxPoints.map(p => [p[0], p[1]] as [number, number]);
      const pl = L.polyline(latlngs, { color: IMBA[seg.difficulty].hex, weight: 5, opacity: 1 }).addTo(this.map);
      this.tourLayers.push(pl);
      this.addSegmentLabel(seg, latlngs);
    }

    if (fullRoute.length)
      this.map.fitBounds(L.latLngBounds(fullRoute), { padding: [50, 50], maxZoom: 14, animate: true });

    this.showElevation(tour, tour.elevationProfile,
      tour.hasFullGpx ? undefined : tour.segments);
  }

  /** Small pill badge showing difficulty name, anchored to polyline midpoint */
  private addSegmentLabel(seg: TourSegment, latlngs: [number, number][]) {
    if (!seg.difficulty) return;
    const mid = latlngs[Math.floor(latlngs.length / 2)];
    const color = IMBA[seg.difficulty].hex;
    const icon = L.divIcon({
      html: `<div class="seg-label" style="border-color:${color};color:${color}">${seg.name ?? ''}</div>`,
      className: '',
      iconAnchor: [0, 0],
    });
    const lbl = L.marker(mid, { icon, interactive: false, keyboard: false }).addTo(this.map);
    this.tourLayers.push(lbl);
  }

  // ── Elevation profile ──────────────────────────────────────────────────────

  private showElevation(item: AnyItem, profile: ElevationPoint[], segments?: TourSegment[]) {
    this.removeHoverMarker();
    const panel = this.panel.querySelector('.spot-elevation-panel')!;
    panel.querySelector('.spot-elevation-name')!.textContent = item.name;
    panel.querySelector('.spot-elevation-chart')!.innerHTML  = this.elevationSVG(profile, item, segments);
    panel.querySelector('.spot-elevation-stats')!.innerHTML  =
      `<span>📍 ${item.distance_km} km</span>` +
      `<span>↑ ${item.elevation_gain} m</span>` +
      `<span>↓ ${item.elevation_loss} m</span>` +
      `<span>${DIR_LABEL[item.direction]}</span>`;

    // GPX download link
    const dlLink = panel.querySelector('.spot-elevation-download') as HTMLAnchorElement;
    if (item.gpx_url) {
      dlLink.href = item.gpx_url;
      dlLink.download = `${item.name}.gpx`;
      dlLink.classList.remove('hidden');
    } else {
      dlLink.classList.add('hidden');
    }

    panel.classList.remove('hidden');
    requestAnimationFrame(() => this.bindElevationHover(item));
  }

  private closeElevation() {
    this.removeHoverMarker();
    this.panel.querySelector('.spot-elevation-panel')!.classList.add('hidden');
    if (this.activeId) {
      // Restore individual trail polylines and remove tour segments
      this.clearTourLayers();
      this.polylineMap.forEach(pl => pl.setStyle({ weight: 3, opacity: 0.65 }));
      this.activeId = null;
    }
    this.panel.querySelectorAll('.spot-item').forEach(i => i.classList.remove('active'));
  }

  private removeHoverMarker() {
    if (this.hoverMarker) {
      this.overlayLayer.removeLayer(this.hoverMarker);
      this.hoverMarker = null;
    }
  }

  private bindElevationHover(item: AnyItem) {
    const svgEl = this.panel.querySelector('.spot-elevation-chart svg') as SVGSVGElement | null;
    if (!svgEl || item.gpxPoints.length < 2) return;

    // Must match elevationSVG constants
    const PL = 30, PT = 6, cW = 264, cH = 64;
    const profile = item.elevationProfile;
    const maxDist = profile[profile.length - 1]?.dist || 1;
    const alts    = profile.map(p => p.alt);
    const minA    = Math.min(...alts);
    const rangeA  = Math.max(...alts) - minA || 1;
    const color   = 'difficulty' in item ? IMBA[(item as MtbTrail).difficulty].hex : '#444';

    const scrubber = svgEl.querySelector('.elev-scrubber') as SVGGElement;
    const scrubLine = svgEl.querySelector('.elev-scrub-line') as SVGLineElement;
    const scrubDot  = svgEl.querySelector('.elev-scrub-dot')  as SVGCircleElement;
    const scrubTxt  = svgEl.querySelector('.elev-scrub-txt')  as SVGTextElement;

    const closestIdx = (dist: number): number => {
      let best = 0, bestDiff = Infinity;
      for (let i = 0; i < profile.length; i++) {
        const d = Math.abs(profile[i].dist - dist);
        if (d < bestDiff) { bestDiff = d; best = i; }
      }
      return best;
    };

    const onMove = (clientX: number) => {
      const rect   = svgEl.getBoundingClientRect();
      const scaleX = 300 / rect.width;                       // viewBox→rendered
      const svgX   = (clientX - rect.left) * scaleX;
      const chartX = Math.max(0, Math.min(svgX - PL, cW));
      const dist   = (chartX / cW) * maxDist;
      const idx    = closestIdx(dist);
      const pt     = profile[idx];
      const gpx    = item.gpxPoints[idx];

      // SVG coordinates for this point
      const x  = PL + (pt.dist / maxDist) * cW;
      const y  = PT + cH - ((pt.alt - minA) / rangeA) * cH;

      scrubLine.setAttribute('x1', String(x));
      scrubLine.setAttribute('x2', String(x));
      scrubDot.setAttribute('cx',  String(x));
      scrubDot.setAttribute('cy',  String(y));
      scrubDot.setAttribute('stroke', color);

      // Keep label inside SVG bounds; flip above/below the curve
      const labelY = y > PT + cH / 2 ? y - 7 : y + 14;
      scrubTxt.setAttribute('x', String(Math.max(18, Math.min(x, 282))));
      scrubTxt.setAttribute('y', String(labelY));
      scrubTxt.textContent = `${Math.round(pt.alt)} m`;

      scrubber.removeAttribute('visibility');

      // Map marker
      if (!this.hoverMarker) {
        this.hoverMarker = L.circleMarker([gpx[0], gpx[1]], {
          radius: 7, color, weight: 2.5,
          fillColor: '#fff', fillOpacity: 1,
          interactive: false,
        }).addTo(this.overlayLayer);
      } else {
        this.hoverMarker.setLatLng([gpx[0], gpx[1]]);
        this.hoverMarker.setStyle({ color });
      }
    };

    const onLeave = () => {
      scrubber.setAttribute('visibility', 'hidden');
      this.removeHoverMarker();
    };

    svgEl.addEventListener('mousemove', e => onMove(e.clientX));
    svgEl.addEventListener('mouseleave', onLeave);
    svgEl.addEventListener('touchmove', e => { e.preventDefault(); onMove(e.touches[0].clientX); }, { passive: false });
    svgEl.addEventListener('touchend', onLeave);
  }

  private elevationSVG(profile: ElevationPoint[], item: AnyItem, segments?: TourSegment[]): string {
    if (profile.length < 2) return '';
    const W = 300, H = 88;
    const PL = 30, PR = 6, PT = 6, PB = 18;
    const cW = W - PL - PR, cH = H - PT - PB;

    const alts   = profile.map(p => p.alt);
    const minA   = Math.min(...alts), maxA = Math.max(...alts);
    const rangeA = maxA - minA || 1;
    const maxD   = profile[profile.length - 1].dist || 1;

    const px = (d: number) => PL + (d / maxD) * cW;
    const py = (a: number) => PT + cH - ((a - minA) / rangeA) * cH;

    // Y / X axis labels
    const yLabels = [minA, minA + rangeA / 2, maxA].map(a =>
      `<text x="${PL - 3}" y="${py(a) + 3.5}" text-anchor="end" font-size="8" fill="#999">${Math.round(a)}</text>`
    ).join('');
    const xLabels = [0, maxD / 2, maxD].map(d =>
      `<text x="${px(d).toFixed(1)}" y="${H - 3}" text-anchor="middle" font-size="8" fill="#999">${d.toFixed(1)} km</text>`
    ).join('');

    // Build profile line(s) — multi-color for tours, single color for trails
    let profileLines = '';
    let fillPath     = '';

    if (segments && segments.length) {
      // Map each segment to its slice of the profile by cumulative point count
      let ptIdx = 0;
      for (const seg of segments) {
        const n    = seg.gpxPoints.length;
        const pts  = profile.slice(ptIdx, ptIdx + n);
        ptIdx += n;
        if (pts.length < 2) continue;

        const color  = seg.type === 'trail' ? IMBA[seg.difficulty!].hex : '#aaa';
        const width  = seg.type === 'trail' ? '2.2' : '1.5';
        const points = pts.map(p => `${px(p.dist).toFixed(1)},${py(p.alt).toFixed(1)}`).join(' ');
        profileLines += `<polyline points="${points}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linejoin="round" opacity="${seg.type === 'trail' ? 1 : 0.6}"/>`;
      }
      // Light gray fill under the whole profile for tours
      const allPts = profile.map(p => `${px(p.dist).toFixed(1)},${py(p.alt).toFixed(1)}`).join(' ');
      const fD = `M ${allPts.replace(/ /g, ' L ')} L${px(maxD).toFixed(1)},${(PT + cH).toFixed(1)} L${px(0).toFixed(1)},${(PT + cH).toFixed(1)} Z`;
      fillPath = `<path d="${fD}" fill="rgba(0,0,0,0.04)"/>`;
    } else {
      // Single trail → use IMBA color; tour without segment data → neutral gray
      const diff   = 'difficulty' in item ? (item as MtbTrail).difficulty : null;
      const color  = diff ? IMBA[diff].hex : '#666';
      const gradId = `eg-${diff ?? 'tour'}`;
      const linePts = profile.map(p => `${px(p.dist).toFixed(1)},${py(p.alt).toFixed(1)}`).join(' ');
      const pathD   = `M ${linePts.replace(/ /g, ' L ')}`;
      const fD      = `${pathD} L${px(maxD).toFixed(1)},${(PT + cH).toFixed(1)} L${px(0).toFixed(1)},${(PT + cH).toFixed(1)} Z`;
      fillPath     = `<defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="${color}" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.03"/>
        </linearGradient>
      </defs>
      <path d="${fD}" fill="url(#${gradId})"/>`;
      profileLines = `<polyline points="${linePts}" stroke="${color}" stroke-width="1.8" fill="none" stroke-linejoin="round"/>`;
    }

    return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" style="cursor:crosshair;overflow:visible">
      <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT + cH}" stroke="#eee" stroke-width="1"/>
      <line x1="${PL}" y1="${PT + cH}" x2="${PL + cW}" y2="${PT + cH}" stroke="#eee" stroke-width="1"/>
      ${fillPath}
      ${profileLines}
      ${yLabels}
      ${xLabels}
      <g class="elev-scrubber" visibility="hidden" pointer-events="none">
        <line class="elev-scrub-line"
          x1="0" y1="${PT}" x2="0" y2="${PT + cH}"
          stroke="rgba(80,80,80,0.55)" stroke-width="1.5"/>
        <circle class="elev-scrub-dot" cx="0" cy="0" r="4.5" fill="white" stroke-width="2.5"/>
        <text class="elev-scrub-txt" x="0" y="0"
          text-anchor="middle" font-size="9" font-weight="700" fill="#333"
          style="text-shadow:0 0 3px #fff,0 0 3px #fff"/>
      </g>
    </svg>`;
  }

  // ── Polylines ──────────────────────────────────────────────────────────────

  /** Draw one polyline per individual trail. Tours are drawn only when selected. */
  private drawPolylines(data: SpotMtbData) {
    this.overlayLayer.clearLayers();
    this.clearTourLayers();
    this.polylineMap.clear();

    for (const trail of data.trails) {
      const latlngs  = trail.gpxPoints.map(p => [p[0], p[1]] as [number, number]);
      const color    = IMBA[trail.difficulty].hex;
      const directed = trail.direction !== 'both';
      const reversed = trail.direction === 'ccw';

      const pl = L.polyline(latlngs, {
        color,
        weight: 3,
        opacity: 0.65,
        className: directed
          ? (reversed ? 'trail-line-reversed' : 'trail-line-directed')
          : '',
      }).addTo(this.overlayLayer);

      if (directed && latlngs.length >= 2)
        this.addDirectionMarker(latlngs, color, reversed);

      this.polylineMap.set(trail.id, pl);
    }
  }

  private addDirectionMarker(pts: [number, number][], color: string, reverse: boolean) {
    // Place a small arrow marker at ~20% along the path
    const idx = Math.max(1, Math.floor(pts.length * 0.2));
    const [lat1, lng1] = pts[idx - 1];
    const [lat2, lng2] = pts[idx];
    const dy = lat2 - lat1;
    const dx = (lng2 - lng1) * Math.cos(lat1 * Math.PI / 180);
    const bearing = Math.atan2(dx, dy) * 180 / Math.PI + (reverse ? 180 : 0);
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;

    const icon = L.divIcon({
      html: `<div style="transform:rotate(${bearing}deg);color:${color};font-size:13px;line-height:1;filter:drop-shadow(0 0 1px #fff)">▲</div>`,
      className: 'trail-arrow-icon',
      iconSize: [13, 13],
      iconAnchor: [6.5, 6.5],
    });

    L.marker([midLat, midLng], { icon, interactive: false, keyboard: false })
      .addTo(this.overlayLayer);
  }
}
