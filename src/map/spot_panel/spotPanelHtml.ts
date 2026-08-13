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

/**
 * Status card for the elevation view: shown when a selected item is a trail
 * (not a tour — tours have no closed_from/closed_to/hint of their own) whose
 * derived status isn't plain "open". Reuses buildTrailStatusContent so the
 * elevation view, the map popup, and the map sheet all render identically.
 * Returns null when nothing should be shown, so the caller can skip
 * appending anything.
 *
 * Returns an HTMLElement (not a markup string) — SpotPanelElevation.vue
 * (src/components/map/SpotPanelElevation.vue) appends it imperatively via a
 * template ref rather than v-html, same as the vanilla showElevation() did
 * (see the spot-panel Vue migration spec's Phase 3 notes).
 */
export function trailStatusCardFor(item: MtbTrail | MtbTour, spotName: string): HTMLElement | null {
  if (!('difficulty' in item)) return null;
  const status = deriveTrailStatus({ closed_from: item.closed_from, closed_to: item.closed_to, hint: item.hint }, new Date());
  if (status.state === 'open') return null;
  return buildTrailStatusContent(status, spotName);
}

// toursHTML() and trailsHTML() (plus their private tourDifficultyDots()/
// trailStatusRowClass()/trailStatusTagHtml() helpers) were removed here —
// superseded by the SpotPanelToursTab.vue / SpotPanelTrailsTab.vue islands
// (src/components/map/SpotPanelToursTab.vue, SpotPanelTrailsTab.vue) as part
// of the spot-panel Vue migration, Phase 3 (see
// docs/superpowers/specs/2026-08-13-spot-panel-vue-migration-design.md).
//
// parkingHTML() and its tests were removed here in Phase 1; commentsHTML()
// and its tests were removed here in Phase 2 (see the same spec).
