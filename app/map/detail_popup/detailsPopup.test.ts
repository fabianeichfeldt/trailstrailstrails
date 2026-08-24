import { describe, it, expect } from 'vitest'
import { renderTrailDetails } from './detailsPopup'
import { TrailDetails } from '../../types/TrailDetails'
import type { Trail } from '../../types/Trail'
import type { Auth } from '../../auth/auth'

const trail: Trail = {
  type: 'trail',
  name: 'Test Trail',
  id: 't1',
  creator: '',
  url: '',
  instagram: '',
  latitude: 0,
  longitude: 0,
  spotcheck: '',
  approved: true,
  created_at: '',
}

const auth = { authService: { loggedIn: false } } as unknown as Auth

function makeDetails(overrides: Partial<TrailDetails>): TrailDetails {
  return Object.assign(new TrailDetails('t1'), overrides)
}

describe('renderSpotStatusBanner (via renderTrailDetails)', () => {
  it('hides status_hint when the spot is open', () => {
    const html = renderTrailDetails(trail, makeDetails({ status: 'open', status_hint: 'Gesperrt bis Ende März' }), auth)
    expect(html).not.toContain('ssb-hint')
    expect(html).not.toContain('Gesperrt bis Ende März')
  })

  it('hides status_hint when the status is unknown', () => {
    const html = renderTrailDetails(trail, makeDetails({ status: 'unknown', status_hint: 'Forstarbeiten' }), auth)
    expect(html).not.toContain('ssb-hint')
  })

  it('shows status_hint when the spot is fully closed', () => {
    const html = renderTrailDetails(trail, makeDetails({ status: 'closed', status_hint: 'Forstarbeiten' }), auth)
    expect(html).toContain('ssb-hint')
    expect(html).toContain('Forstarbeiten')
  })

  it('shows status_hint when the spot is partly closed (limited)', () => {
    const html = renderTrailDetails(trail, makeDetails({ status: 'limited', status_hint: 'Ein Trail gesperrt' }), auth)
    expect(html).toContain('ssb-hint')
    expect(html).toContain('Ein Trail gesperrt')
  })

  it('falls back to a "Gesperrt bis" auto-hint when closed without a status_hint but with status_until', () => {
    const html = renderTrailDetails(trail, makeDetails({ status: 'closed', status_until: '2099-12-31' }), auth)
    expect(html).toContain('ssb-hint')
    expect(html).toContain('Gesperrt bis')
  })

  it('shows rain policy when open', () => {
    const html = renderTrailDetails(trail, makeDetails({ status: 'open', rain_policy: 'during' }), auth)
    expect(html).toContain('ssb-rain')
    expect(html).toContain('Geschlossen bei Regen')
  })

  it('shows rain policy when limited', () => {
    const html = renderTrailDetails(trail, makeDetails({ status: 'limited', rain_policy: 'after', rain_closed_hours: 12 }), auth)
    expect(html).toContain('ssb-rain')
    expect(html).toContain('12h nach Regen')
  })

  it('shows rain policy when status is unknown', () => {
    const html = renderTrailDetails(trail, makeDetails({ status: 'unknown', rain_policy: 'during' }), auth)
    expect(html).toContain('ssb-rain')
  })

  it('hides rain policy when the spot is fully closed', () => {
    const html = renderTrailDetails(trail, makeDetails({ status: 'closed', rain_policy: 'during' }), auth)
    expect(html).not.toContain('ssb-rain')
  })

  it('omits both rows when neither field is set', () => {
    const html = renderTrailDetails(trail, makeDetails({ status: 'open' }), auth)
    expect(html).not.toContain('ssb-hint')
    expect(html).not.toContain('ssb-rain')
  })
})
