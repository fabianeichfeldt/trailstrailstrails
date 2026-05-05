import { ImbaColor, MtbTour, MtbTrail, TrailDirection } from '../../types/MtbTypes';
import { IMBA } from './elevationSvg';

export const DIR_LABEL: Record<TrailDirection, string> = {
  'cw':           '↻ Uhrzeigersinn',
  'ccw':          '↺ Gegen Uhrzeiger',
  'one-way-down': '⤵ Nur bergab',
  'one-way-up':   '⤴ Nur bergauf',
  'both':         '↔ Beide Richtungen',
};

function tourDifficultyDots(tour: MtbTour): string {
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

export function toursHTML(tours: MtbTour[]): string {
  if (!tours.length) return '<p class="spot-empty">Keine Touren für diesen Spot.</p>';
  return tours.map(t => `
    <div class="spot-item" data-id="${t.id}" data-kind="tour">
      <div class="spot-item-left">
        <div class="imba-dots">${tourDifficultyDots(t)}</div>
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
        </div>
        <span class="spot-item-arrow">›</span>
      </div>
    </div>`).join('');
}

export function trailsHTML(trails: MtbTrail[]): string {
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
