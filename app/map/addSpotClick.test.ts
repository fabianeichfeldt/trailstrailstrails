import { describe, it, expect, vi } from 'vitest'
import { resolveAddClick } from './addSpotClick'

const latlng = { lat: 48.1, lng: 11.5 }

describe('resolveAddClick', () => {
  it('does nothing outside add mode, without looking for neighbours', async () => {
    const findNearby = vi.fn()
    expect(await resolveAddClick({ mode: undefined, latlng, findNearby, askConflict: vi.fn() })).toBeNull()
    expect(findNearby).not.toHaveBeenCalled()
  })

  it('picks the clicked point with the armed type when nothing is nearby', async () => {
    const askConflict = vi.fn()
    const r = await resolveAddClick({ mode: 'bikepark', latlng, findNearby: () => null, askConflict })
    expect(r).toEqual({ lat: 48.1, lng: 11.5, type: 'bikepark' })
    expect(askConflict).not.toHaveBeenCalled()
  })

  it('asks about a nearby spot and proceeds when confirmed', async () => {
    const near = { id: 'x' }
    const askConflict = vi.fn().mockResolvedValue(true)
    const r = await resolveAddClick({ mode: 'trail', latlng, findNearby: () => near, askConflict })
    expect(askConflict).toHaveBeenCalledWith(near)
    expect(r).toEqual({ lat: 48.1, lng: 11.5, type: 'trail' })
  })

  it('returns null when the user declines the nearby conflict', async () => {
    const r = await resolveAddClick({ mode: 'trail', latlng, findNearby: () => ({ id: 'x' }), askConflict: async () => false })
    expect(r).toBeNull()
  })

  it('passes the click coordinates to the neighbour lookup', async () => {
    const findNearby = vi.fn().mockReturnValue(null)
    await resolveAddClick({ mode: 'trail', latlng, findNearby, askConflict: vi.fn() })
    expect(findNearby).toHaveBeenCalledWith(48.1, 11.5)
  })
})
