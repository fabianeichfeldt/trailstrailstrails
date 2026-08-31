// The app's one mechanism for distinguishing viewport modes — mobile vs.
// desktop breakpoint (768px). Originally lived in
// app/map/spot_panel/dragHandle.ts (the deleted SpotPanel bottom-sheet's
// drag/snap logic); moved here once that file was retired
// (spot-detail-real-pages rework, Phase 4) since useTrailMap.ts's trail-
// status badge (desktop popup vs. mobile bottom-sheet) still needs it.
export const isDesktopViewport = () => window.innerWidth >= 768
