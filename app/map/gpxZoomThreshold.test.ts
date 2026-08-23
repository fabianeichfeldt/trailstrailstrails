import { describe, it, expect } from 'vitest'
import { shouldShowGpx, GPX_ZOOM_THRESHOLD } from './gpxZoomThreshold'

describe('shouldShowGpx', () => {
  it('is false when there is no GPX data, regardless of zoom', () => {
    expect(shouldShowGpx(false, GPX_ZOOM_THRESHOLD + 5)).toBe(false)
  })

  it('is false when GPX exists but zoom is below the threshold', () => {
    expect(shouldShowGpx(true, GPX_ZOOM_THRESHOLD - 1)).toBe(false)
  })

  it('is true when GPX exists and zoom is at the threshold', () => {
    expect(shouldShowGpx(true, GPX_ZOOM_THRESHOLD)).toBe(true)
  })

  it('is true when GPX exists and zoom is above the threshold', () => {
    expect(shouldShowGpx(true, GPX_ZOOM_THRESHOLD + 5)).toBe(true)
  })

  it('accepts a custom threshold', () => {
    expect(shouldShowGpx(true, 8, 9)).toBe(false)
    expect(shouldShowGpx(true, 9, 9)).toBe(true)
  })
})
