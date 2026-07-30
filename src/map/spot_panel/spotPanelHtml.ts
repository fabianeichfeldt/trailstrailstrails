import { ImbaColor, MtbTour, MtbTrail, TrailDirection } from '../../types/MtbTypes';
import { IMBA } from './elevationSvg';
import type { SpotParkingLot } from '../../communication/trails';

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

const PARKING_HINT_LABELS: Record<keyof Pick<SpotParkingLot, 'weight_limit_hint' | 'opening_hours_hint' | 'cost_hint' | 'charging_hint'>, string> = {
  weight_limit_hint:  '⚖️ Gewichtsbeschränkung',
  opening_hours_hint: '🕐 Öffnungszeiten',
  cost_hint:          '💶 Kosten',
  charging_hint:      '🔌 Lademöglichkeit',
};

function parkingHintLines(lot: SpotParkingLot): string {
  return (Object.keys(PARKING_HINT_LABELS) as Array<keyof typeof PARKING_HINT_LABELS>)
    .filter(key => lot[key] != null && lot[key] !== '')
    .map(key => `<div class="parking-hint"><strong>${PARKING_HINT_LABELS[key]}:</strong> ${lot[key]}</div>`)
    .join('');
}

export function parkingHTML(lots: SpotParkingLot[], highlightId?: string): string {
  if (!lots.length) return '<p class="spot-empty">Keine Parkplätze für diesen Spot.</p>';
  return lots.map(lot => `
    <div class="spot-item parking-item${lot.id === highlightId ? ' active' : ''}" data-id="${lot.id}" data-kind="parking">
      <div class="spot-item-left">
        <div class="parking-badge">P</div>
        <div class="spot-item-info">
          <div class="spot-item-name"><strong>${lot.name}</strong></div>
          <div class="parking-hints">${parkingHintLines(lot)}</div>
        </div>
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
