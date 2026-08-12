import { ImbaColor, MtbTour, MtbTrail, TrailDirection } from '../../types/MtbTypes';
import { IMBA } from './elevationSvg';
import type { SpotParkingLot } from '../../communication/trails';
import { deriveTrailStatus } from '../../types/TrailStatus';
import { buildTrailStatusContent } from '../trailStatusSheet';
import { Comment } from '../../types/Comment';
import { formatDate } from '../../utils/formatDate';
import { escapeHtml } from '../../utils/escapeHtml';

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

// ── Comments ────────────────────────────────────────────────────────────────

function commentCountLabel(count: number, hasMore: boolean): string {
  const suffix = hasMore ? '+' : '';
  const noun = count === 1 && !hasMore ? 'Kommentar' : 'Kommentare';
  return `${count}${suffix} ${noun}`;
}

function commentRowHTML(c: Comment, currentUserId: string, canModerate: boolean): string {
  const canDelete = c.user_id === currentUserId || canModerate;
  const name = escapeHtml(c.profiles?.display_name || 'Anonym');
  return `
    <div class="comment-row" data-comment-id="${c.id}">
      <div class="comment-meta">
        <span class="comment-author">${name}</span>
        <span class="comment-date">${formatDate(c.created_at)}</span>
      </div>
      <p class="comment-text">${escapeHtml(c.comment_text)}</p>
      <div class="comment-actions">
        <button class="comment-reply-btn" data-action="reply-comment" data-author="${name}">Antworten</button>
        ${canDelete ? `<button class="comment-delete-btn" data-action="delete-comment" data-comment-id="${c.id}" aria-label="Kommentar löschen"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>
    </div>`;
}

export interface CommentsHtmlOptions {
  expanded: boolean;
  hasMore: boolean;
  loggedIn: boolean;
  currentUserId: string;
  canModerate: boolean;
}

export function commentsHTML(comments: Comment[], opts: CommentsHtmlOptions): string {
  const { expanded, hasMore, loggedIn, currentUserId, canModerate } = opts;

  const header = `
    <div class="comments-header" data-action="toggle-comments">
      <span class="comments-count">💬 ${commentCountLabel(comments.length, hasMore)}</span>
      <span class="comments-toggle-icon">${expanded ? '▲' : '▼'}</span>
    </div>`;

  if (!expanded) return header;

  const list = comments.length
    ? `<div class="comments-list">${comments.map(c => commentRowHTML(c, currentUserId, canModerate)).join('')}</div>`
    : '<p class="spot-empty">Noch keine Kommentare. Sei der Erste!</p>';

  const loadMore = hasMore
    ? `<button class="comments-load-more" data-action="load-more-comments">Ältere Kommentare laden</button>`
    : '';

  const writeBox = loggedIn
    ? `
      <div class="comments-write-box">
        <textarea class="comments-input" maxlength="500" placeholder="Kommentar schreiben…"></textarea>
        <div class="comments-write-footer">
          <span class="comments-char-count">0 / 500</span>
          <button class="comments-post-btn" data-action="post-comment" disabled>Senden</button>
        </div>
        <div class="comments-error hidden"></div>
      </div>`
    : `
      <div class="comments-login-prompt">
        <span class="comments-login-link" data-action="login-comments">Einloggen zum Kommentieren</span>
      </div>`;

  return `${header}${list}${loadMore}${writeBox}`;
}
