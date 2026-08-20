import { MtbTour, MtbTrail, TrailDirection } from '../../types/MtbTypes';
import { deriveTrailStatus } from '../../types/TrailStatus';
import { buildTrailStatusContent } from '../trailStatusSheet';

export const DIR_LABEL: Record<TrailDirection, string> = {
  'cw':           '↻ Uhrzeigersinn',
  'ccw':          '↺ Gegen Uhrzeiger',
  'one-way-down': '⤵ Nur bergab',
  'one-way-up':   '⤴ Nur bergauf',
  'both':         '↔ Beide Richtungen',
};

// Icon-only counterpart of DIR_LABEL — used where a full-text tag would take
// a whole line (e.g. the trail list rows), with DIR_LABEL kept as the
// title/aria-label so the full German text stays reachable.
export const DIR_ICON: Record<TrailDirection, string> = {
  'cw':           '↻',
  'ccw':          '↺',
  'one-way-down': '⤵',
  'one-way-up':   '⤴',
  'both':         '↔',
};

/**
 * Status card for the elevation view: shown when a selected item is a trail
 * (not a tour — tours have no closed_from/closed_to/hint of their own) whose
 * derived status isn't plain "open". Reuses buildTrailStatusContent so the
 * elevation view, the map popup, and the map sheet all render identically.
 * Returns null when nothing should be shown, so the caller can skip
 * appending anything.
 *
 * Returns an HTMLElement (not a markup string) — callers that need it in a
 * Vue template must append it imperatively (e.g. via a template ref),
 * not v-html.
 */
export function trailStatusCardFor(item: MtbTrail | MtbTour, spotName: string): HTMLElement | null {
  if (!('difficulty' in item)) return null;
  const status = deriveTrailStatus({ closed_from: item.closed_from, closed_to: item.closed_to, hint: item.hint }, new Date());
  if (status.state === 'open') return null;
  return buildTrailStatusContent(status, spotName);
}
