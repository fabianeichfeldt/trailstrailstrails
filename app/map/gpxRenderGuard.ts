export type ViewMode = 'markers' | 'gpx'

/**
 * Tracks the current render generation and view mode so that
 * renderGpxView can detect both:
 *   (a) being superseded by a newer GPX render, and
 *   (b) having had the mode switched back to markers while the
 *       async fetch was in flight.
 *
 * Both conditions make a pending render stale and it must abort
 * without touching the map.
 */
export class GpxRenderGuard {
  private _renderGen = 0
  private _viewMode: ViewMode = 'markers'
  // Set once the owning composable unmounts (useTrailMap.ts's cleanupFn) —
  // e.g. a marker/search click now does a real router.push instead of
  // opening a panel on top of the still-live map (spot-detail-real-pages
  // rework), so the map (and this guard) can be torn down while a
  // renderGpxView() fetch is still in flight. Without this, the async
  // continuation resumes after the Leaflet map instance has already been
  // .remove()'d and throws trying to add layers to it.
  private _destroyed = false

  get viewMode(): ViewMode { return this._viewMode }

  enterGpxMode(): void { this._viewMode = 'gpx' }
  enterMarkerMode(): void { this._viewMode = 'markers' }

  /** Call at the top of renderGpxView to get a generation token. */
  beginRender(): number { return ++this._renderGen }

  /** Call from the owning composable's unmount cleanup. */
  destroy(): void { this._destroyed = true }

  /**
   * Returns true when a render that received `gen` from beginRender()
   * should be aborted — a newer render started, the mode switched back to
   * markers while the fetch was in flight, or the map has been torn down.
   */
  isStale(gen: number): boolean {
    return this._destroyed || gen !== this._renderGen || this._viewMode !== 'gpx'
  }
}
