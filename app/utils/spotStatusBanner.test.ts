import { describe, it, expect, vi, afterEach } from 'vitest'
import { computeEffectiveStatus } from './spotStatusBanner'

describe('computeEffectiveStatus', () => {
  afterEach(() => vi.useRealTimers())

  it('defaults to open when status is unset', () => {
    expect(computeEffectiveStatus({})).toEqual({ status: 'open' })
  })

  it('passes through closed/limited/unknown untouched when no status_until is set', () => {
    expect(computeEffectiveStatus({ status: 'closed' })).toEqual({ status: 'closed' })
    expect(computeEffectiveStatus({ status: 'limited' })).toEqual({ status: 'limited' })
    expect(computeEffectiveStatus({ status: 'unknown' })).toEqual({ status: 'unknown' })
  })

  it('reverts a temporary closure to open once status_until has passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-25T12:00:00'))
    expect(computeEffectiveStatus({ status: 'closed', status_until: '2026-08-01' })).toEqual({ status: 'open' })
  })

  it('keeps a temporary closure active while status_until is still in the future', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-25T12:00:00'))
    expect(computeEffectiveStatus({ status: 'closed', status_until: '2026-12-31' })).toEqual({ status: 'closed' })
  })

  it('reports a seasonal closure with a formatted reason while inside the season window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00'))
    expect(computeEffectiveStatus({ status: 'open', seasonal_from: '05-01', seasonal_to: '09-30' }))
      .toEqual({ status: 'closed', reason: 'Saisonale Sperrung 01.05. – 30.09.' })
  })

  it('leaves status untouched when outside the seasonal window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00'))
    expect(computeEffectiveStatus({ status: 'open', seasonal_from: '05-01', seasonal_to: '09-30' }))
      .toEqual({ status: 'open' })
  })

  it('handles a seasonal window that wraps the new year', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00'))
    expect(computeEffectiveStatus({ status: 'open', seasonal_from: '11-01', seasonal_to: '02-28' }))
      .toEqual({ status: 'closed', reason: 'Saisonale Sperrung 01.11. – 28.02.' })
  })
})
