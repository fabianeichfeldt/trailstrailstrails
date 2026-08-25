import { describe, it, expect } from 'vitest'
import { bakedTrailDetails } from './bakedTrailDetails'

describe('bakedTrailDetails', () => {
  it('returns empty defaults for null/undefined input', () => {
    const d = bakedTrailDetails(null)
    expect(d.rules).toEqual([])
    expect(d.photos).toEqual([])
    expect(d.likes).toEqual([])
    expect(d.videos).toEqual([])
  })

  it('maps the baked JSON fields onto a TrailDetails shape', () => {
    const d = bakedTrailDetails({
      id: 't1',
      rules: ['Helmpflicht'],
      description: 'legacy field',
      trail_description: 'Ein toller Trail.',
      opening_hours: 'ganzjährig',
      photos: [{ id: 'p1', url: 'https://example.com/p1.jpg', created_at: '2026-01-01', profiles: { display_name: 'Alice', avatar_url: '' } }],
      status: 'closed',
      status_hint: 'Wegen Bauarbeiten',
      access_type: 'paid',
      donation_url: 'https://example.com/donate',
      seasonal_from: '05-01',
      seasonal_to: '09-30',
      rain_policy: 'during',
      rain_closed_hours: 12,
      last_update: '2026-08-01',
    })

    expect(d.id).toBe('t1')
    expect(d.rules).toEqual(['Helmpflicht'])
    expect(d.trail_description).toBe('Ein toller Trail.')
    expect(d.opening_hours).toBe('ganzjährig')
    expect(d.photos).toHaveLength(1)
    expect(d.status).toBe('closed')
    expect(d.status_hint).toBe('Wegen Bauarbeiten')
    expect(d.access_type).toBe('paid')
    expect(d.donation_url).toBe('https://example.com/donate')
    expect(d.seasonal_from).toBe('05-01')
    expect(d.seasonal_to).toBe('09-30')
    expect(d.rain_policy).toBe('during')
    expect(d.rain_closed_hours).toBe(12)
    expect(d.last_update).toBe('2026-08-01')
  })

  it('never populates likes/videos — those are not part of the baked payload', () => {
    const d = bakedTrailDetails({ id: 't1', rules: [] })
    expect(d.likes).toEqual([])
    expect(d.videos).toEqual([])
  })
})
