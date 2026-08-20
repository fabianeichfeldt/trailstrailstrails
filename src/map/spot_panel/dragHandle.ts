// Shared mobile/desktop breakpoint check — the app's one mechanism for
// distinguishing viewport modes. Reused by the trail-status badge
// (src/composables/useTrailMap.ts) so desktop popup vs. mobile bottom-sheet
// branching stays consistent with the panel's own mobile/desktop switch.
export const isDesktopViewport = () => window.innerWidth >= 768;

export type SnapPoint = 'peek' | 'half' | 'full';

// Mirrors .spot-panel's mobile min-height/height/max-height in
// spot_panel.css — kept here too since the snap itself is JS-driven, not
// something CSS alone can express.
const SNAP_VH: Record<SnapPoint, number> = { peek: 15, half: 56, full: 92 };
const SNAP_ORDER: SnapPoint[] = ['peek', 'half', 'full'];

// A press-release with less than this much total vertical travel counts as
// a tap, not a drag — forgiving enough that a real finger (which never
// lands perfectly still) still reads as a tap, tight enough that a genuine
// drag-and-release-early never also fires a tap-cycle on top of its own
// snap.
const TAP_THRESHOLD_PX = 6;

// Pure and DOM-free on purpose, so it's unit-testable without mounting
// anything: picks whichever of the three targets currentVh is closest to.
export function nearestSnapPoint(currentVh: number): SnapPoint {
  return (Object.keys(SNAP_VH) as SnapPoint[]).reduce((closest, point) =>
    Math.abs(SNAP_VH[point] - currentVh) < Math.abs(SNAP_VH[closest] - currentVh) ? point : closest,
  'peek' as SnapPoint);
}

// Full transition value, not just `height ...` — setting the inline
// `transition` shorthand to only `height` would replace (not add to)
// .spot-panel's own `transition: transform ...` CSS rule while the inline
// style is present, silently breaking the open/close slide if a snap and a
// close ever land close together. Keep both properties in sync with that
// rule's duration/easing.
const PANEL_TRANSITION = 'height 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)';

// `vh` is pinned to the mobile browser's *large* viewport (chrome
// collapsed), not the currently-visible one — at the 92 target that gap is
// enough to push the sheet's top edge (and its handle) off-screen with no
// way to scroll back to it. `dvh` tracks the viewport that's actually
// visible right now; mirrors the same fallback in spot_panel.css's
// @supports block.
//
// Deliberately not feature-detected via `CSS.supports('height', '100dvh')`:
// some CSSOM implementations report that as supported while their actual
// style parser still silently rejects the unit (assignment is a no-op,
// leaving the previous value in place) — the two disagreeing is exactly
// the kind of gap that would leave the sheet's height untouched. Trying
// the real value and reading it back is the only check that can't lie.
function setSnapHeight(panel: HTMLElement, vhValue: number): void {
  const dvhValue = vhValue + 'dvh';
  panel.style.height = dvhValue;
  if (panel.style.height !== dvhValue) {
    panel.style.height = vhValue + 'vh';
  }
}

// Animates the mobile sheet to one of the three snap heights. Exported so
// SpotPanel.vue can trigger a snap-to-full when a tour/trail is selected
// (see its onMounted watch), reusing this instead of duplicating the
// animation/cleanup logic in two places.
export function snapTo(panel: HTMLElement, target: SnapPoint): void {
  panel.style.transition = PANEL_TRANSITION;
  setSnapHeight(panel, SNAP_VH[target]);
  // Clear the inline transition once it's done so it doesn't linger and
  // fight the next drag's `transition: none` — startResize() below already
  // relies on being able to freely overwrite this.
  window.setTimeout(() => {
    panel.style.transition = '';
  }, 260);
}

// One-time settle nudge (see spot_panel.css's .bounce keyframes) — a
// physical cue that the sheet has weight and moves, played once from
// SpotPanel.vue the first time a spot opens. Removing and re-adding the
// class (with a forced reflow between) lets it be retriggered on demand
// rather than only ever playing once per element lifetime.
export function playInviteBounce(panel: HTMLElement): void {
  panel.classList.remove('bounce');
  void panel.offsetWidth;
  panel.classList.add('bounce');
  window.setTimeout(() => panel.classList.remove('bounce'), 950);
}

export function initDragHandle(panel: HTMLElement): void {
  const handle = panel.querySelector('.spot-panel-handle') as HTMLElement;
  let isResizing = false;
  let startPos = 0;
  let startSize = 0;
  let isHorizontal = false;
  let maxMove = 0;

  const isDesktopMode = isDesktopViewport;

  const updateHandlePosition = () => {
    if (isDesktopMode()) {
      const rect = panel.getBoundingClientRect();
      handle.style.left = (rect.left - 4) + 'px';
      handle.style.display = 'block';
    } else {
      handle.style.display = '';
      handle.style.left = '';
    }
  };

  const startResize = (clientX: number, clientY: number) => {
    isResizing = true;
    isHorizontal = isDesktopMode();
    maxMove = 0;
    if (isHorizontal) {
      startPos = clientX;
      startSize = panel.getBoundingClientRect().width;
    } else {
      startPos = clientY;
      startSize = panel.getBoundingClientRect().height;
    }
    panel.style.transition = 'none';
    panel.style.userSelect = 'none';
  };

  const doResize = (clientX: number, clientY: number) => {
    if (!isResizing) return;
    if (isHorizontal) {
      maxMove = Math.max(maxMove, Math.abs(clientX - startPos));
      const w = Math.max(280, Math.min(window.innerWidth * 0.6, startSize - (clientX - startPos)));
      panel.style.width = w + 'px';
      updateHandlePosition();
    } else {
      maxMove = Math.max(maxMove, Math.abs(clientY - startPos));
      const min = window.innerHeight * (SNAP_VH.peek / 100);
      const max = window.innerHeight * (SNAP_VH.full / 100);
      const h = Math.max(min, Math.min(max, startSize + (startPos - clientY)));
      panel.style.height = h + 'px';
    }
  };

  const stopResize = () => {
    if (!isResizing) return;
    isResizing = false;
    panel.style.userSelect = '';
    if (isHorizontal) {
      panel.style.transition = '';
      return;
    }
    const currentVh = (panel.getBoundingClientRect().height / window.innerHeight) * 100;
    if (maxMove < TAP_THRESHOLD_PX) {
      // A tap (barely any movement) advances to the next fixed stop rather
      // than re-snapping to wherever it already was — always the same
      // forward order (peek → half → full → peek…), never reversing, so
      // it stays predictable without needing dots or an icon to explain it.
      const current = nearestSnapPoint(currentVh);
      const next = SNAP_ORDER[(SNAP_ORDER.indexOf(current) + 1) % SNAP_ORDER.length];
      snapTo(panel, next);
    } else {
      snapTo(panel, nearestSnapPoint(currentVh));
    }
  };

  handle.addEventListener('touchstart', e => {
    startResize(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (isResizing && e.touches.length > 0) doResize(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  document.addEventListener('touchend', stopResize, { passive: true });

  handle.addEventListener('mousedown', e => startResize(e.clientX, e.clientY));
  document.addEventListener('mousemove', e => { if (isResizing) doResize(e.clientX, e.clientY); });
  document.addEventListener('mouseup', stopResize);

  updateHandlePosition();
  window.addEventListener('resize', updateHandlePosition);
}
