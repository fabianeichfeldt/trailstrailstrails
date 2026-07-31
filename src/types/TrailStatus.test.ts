import { describe, test, expect } from 'vitest'
import { deriveTrailStatus } from './TrailStatus'

const NOW = new Date('2026-07-31T12:00:00Z')

describe('deriveTrailStatus', () => {
  test('no dates and no hint set → open, no explanation', () => {
    const result = deriveTrailStatus({}, NOW)
    expect(result).toEqual({ state: 'open', explanation: null })
  })

  test('active closure with closed_to set → closed, generic message', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-07-01T00:00:00Z', closed_to: '2026-08-15T00:00:00Z' },
      NOW,
    )
    expect(result.state).toBe('closed')
    expect(result.explanation).toBe('Dieser Trail ist derzeit gesperrt.')
  })

  test('active closure with closed_to null (indefinite) → closed', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-07-01T00:00:00Z', closed_to: null },
      NOW,
    )
    expect(result.state).toBe('closed')
    expect(result.explanation).toBe('Dieser Trail ist derzeit gesperrt.')
  })

  test('future closed_from → closing soon, auto date message', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-09-01T00:00:00Z' },
      NOW,
    )
    expect(result.state).toBe('closing_soon')
    expect(result.explanation).toBe('Geplante Sperrung ab 01.09.2026.')
  })

  test('future closed_from with closed_to → closing soon, auto date range message', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-09-01T00:00:00Z', closed_to: '2026-09-15T00:00:00Z' },
      NOW,
    )
    expect(result.state).toBe('closing_soon')
    expect(result.explanation).toBe('Geplante Sperrung ab 01.09.2026 bis 15.09.2026.')
  })

  test('expired closed_to → back to open, no explanation', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-01-01T00:00:00Z', closed_to: '2026-06-01T00:00:00Z' },
      NOW,
    )
    expect(result).toEqual({ state: 'open', explanation: null })
  })

  test('expired schedule with hint set → still open (schedule wins, ignores hint)', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-01-01T00:00:00Z', closed_to: '2026-06-01T00:00:00Z', hint: 'Winterschaden' },
      NOW,
    )
    expect(result).toEqual({ state: 'open', explanation: null })
  })

  test('hint-only, no schedule → hint state (closing_soon badge), hint text verbatim', () => {
    const result = deriveTrailStatus({ hint: 'Erdrutsch, bitte umfahren' }, NOW)
    expect(result.state).toBe('closing_soon')
    expect(result.explanation).toBe('Erdrutsch, bitte umfahren')
  })

  test('empty-string hint counts as no hint', () => {
    const result = deriveTrailStatus({ hint: '   ' }, NOW)
    expect(result).toEqual({ state: 'open', explanation: null })
  })

  test('active closure with both a schedule and a hint → hint text used as explanation', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-07-01T00:00:00Z', closed_to: '2026-08-15T00:00:00Z', hint: 'Bauarbeiten am Steg' },
      NOW,
    )
    expect(result.state).toBe('closed')
    expect(result.explanation).toBe('Bauarbeiten am Steg')
  })

  test('future closed_from with a hint → hint text used as explanation', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-09-01T00:00:00Z', hint: 'Forstarbeiten geplant' },
      NOW,
    )
    expect(result.state).toBe('closing_soon')
    expect(result.explanation).toBe('Forstarbeiten geplant')
  })
})
