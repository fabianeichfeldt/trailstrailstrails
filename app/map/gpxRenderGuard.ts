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

  get viewMode(): ViewMode { return this._viewMode }

  enterGpxMode(): void { this._viewMode = 'gpx' }
  enterMarkerMode(): void { this._viewMode = 'markers' }

  /** Call at the top of renderGpxView to get a generation token. */
  beginRender(): number { return ++this._renderGen }

  /**
   * Returns true when a render that received `gen` from beginRender()
   * should be aborted — either a newer render started, or the mode
   * switched back to markers while the fetch was in flight.
   */
  isStale(gen: number): boolean {
    return gen !== this._renderGen || this._viewMode !== 'gpx'
  }
}
