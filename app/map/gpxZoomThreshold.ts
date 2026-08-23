/** Zoom level at which a spot's GPX track takes over from its marker. */
export const GPX_ZOOM_THRESHOLD = 11

/** Whether a spot's GPX track should render instead of its marker at the given zoom. */
export function shouldShowGpx(hasGpx: boolean, zoom: number, threshold = GPX_ZOOM_THRESHOLD): boolean {
  return hasGpx && zoom >= threshold
}
