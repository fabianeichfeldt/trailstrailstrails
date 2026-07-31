import { ImbaColor, MtbTour, MtbTrail, TrailDirection } from '../../types/MtbTypes';
import { IMBA } from './elevationSvg';
import type { SpotParkingLot } from '../../communication/trails';
import { deriveTrailStatus } from '../../types/TrailStatus';
import { buildTrailStatusContent } from '../trailStatusSheet';

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

function parkingInfoLines(info?: string[]): string {
  if (!info || !info.length) return '';
  return info.map(line => `<div class="parking-hint">${line}</div>`).join('');
}

export function parkingHTML(lots: SpotParkingLot[], highlightId?: string): string {
  if (!lots.length) return '<p class="spot-empty">Keine Parkplätze für diesen Spot.</p>';
  return lots.map(lot => `
    <div class="spot-item parking-item${lot.id === highlightId ? ' active' : ''}" data-id="${lot.id}" data-kind="parking">
      <div class="spot-item-left">
        <div class="parking-badge">P</div>
        <div class="spot-item-info">
          <div class="spot-item-name"><strong>${lot.name}</strong></div>
          <div class="parking-hints">${parkingInfoLines(lot.info)}</div>
        </div>
      </div>
    </div>`).join('');
}

/**
 * Trails-tab list row: instead of a second icon competing with the IMBA
 * difficulty dot, a closed/hinted trail gets a tinted row background (same
 * accent color language as the map badge / popup card, see
 * src/types/TrailStatus.ts) plus a small "Gesperrt"/"Hinweis" text tag next
 * to the trail name.
 */
function trailStatusRowClass(state: 'open' | 'closing_soon' | 'closed'): string {
  if (state === 'closed') return ' trail-status-row-closed';
  if (state === 'closing_soon') return ' trail-status-row-hint';
  return '';
}

function trailStatusTagHtml(state: 'open' | 'closing_soon' | 'closed'): string {
  if (state === 'closed') return '<span class="trail-status-tag trail-status-tag-closed">Gesperrt</span>';
  if (state === 'closing_soon') return '<span class="trail-status-tag trail-status-tag-hint">Hinweis</span>';
  return '';
}

/**
 * Status card for the elevation view: shown when a selected item is a trail
 * (not a tour — tours have no closed_from/closed_to/hint of their own) whose
 * derived status isn't plain "open". Reuses buildTrailStatusContent so the
 * elevation view, the map popup, and the map sheet all render identically.
 * Returns null when nothing should be shown, so the caller can skip
 * appending anything.
 */
export function trailStatusCardFor(item: MtbTrail | MtbTour, spotName: string): HTMLElement | null {
  if (!('difficulty' in item)) return null;
  const status = deriveTrailStatus({ closed_from: item.closed_from, closed_to: item.closed_to, hint: item.hint }, new Date());
  if (status.state === 'open') return null;
  return buildTrailStatusContent(status, spotName);
}

export function trailsHTML(trails: MtbTrail[]): string {
  if (!trails.length) return '<p class="spot-empty">Keine Trails für diesen Spot.</p>';
  return trails.map(t => {
    const status = deriveTrailStatus({ closed_from: t.closed_from, closed_to: t.closed_to, hint: t.hint }, new Date());
    return `
    <div class="spot-item${trailStatusRowClass(status.state)}" data-id="${t.id}" data-kind="trail">
      <div class="spot-item-left">
        <span class="imba-dot" style="background:${IMBA[t.difficulty].hex}" title="${IMBA[t.difficulty].label}"></span>
        <div class="spot-item-info">
          <div class="spot-item-name">
            <strong>${t.name}</strong>
            ${trailStatusTagHtml(status.state)}
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
    </div>`;
  }).join('');
}
