import { describe, it, expect } from 'vitest'
import { roundCoord, clickEventToLatLng } from './locationPickerUtils'

describe('roundCoord', () => {
  it('rounds to 6 decimal places', () => {
    expect(roundCoord(47.812345678)).toBe(47.812346)
  })

  it('leaves already-short values unchanged', () => {
    expect(roundCoord(13.0)).toBe(13.0)
  })

  it('handles negative coordinates', () => {
    expect(roundCoord(-122.419416123)).toBe(-122.419416)
  })
})

describe('clickEventToLatLng', () => {
  it('extracts and rounds lat/lng from a Leaflet-shaped click event', () => {
    const event = { latlng: { lat: 47.812345678, lng: 13.044455501 } }
    expect(clickEventToLatLng(event)).toEqual({ lat: 47.812346, lng: 13.044456 })
  })

  it('works for a drag event with the same latlng shape', () => {
    const dragEvent = { latlng: { lat: 48.0, lng: 11.5 } }
    expect(clickEventToLatLng(dragEvent)).toEqual({ lat: 48.0, lng: 11.5 })
  })
})
