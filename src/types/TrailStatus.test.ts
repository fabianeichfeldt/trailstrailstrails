import { describe, test, expect } from 'vitest'
import { deriveTrailStatus } from './TrailStatus'

const NOW = new Date('2026-07-31T12:00:00Z')

describe('deriveTrailStatus', () => {
  test('no dates and no hint set → open, nothing to show', () => {
    const result = deriveTrailStatus({}, NOW)
    expect(result).toEqual({ state: 'open', title: null, dateLine: null, hint: null })
  })

  test('active closure with closed_to set → closed, since/until date line, no hint', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-07-01T00:00:00Z', closed_to: '2026-08-15T00:00:00Z' },
      NOW,
    )
    expect(result).toEqual({
      state: 'closed',
      title: 'Aktuell gesperrt',
      dateLine: 'seit 01.07.2026 bis 15.08.2026',
      hint: null,
    })
  })

  test('active closure with closed_to null (indefinite) → closed, since date line, no until', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-07-01T00:00:00Z', closed_to: null },
      NOW,
    )
    expect(result).toEqual({
      state: 'closed',
      title: 'Aktuell gesperrt',
      dateLine: 'seit 01.07.2026',
      hint: null,
    })
  })

  test('future closed_from → closing soon, auto date line', () => {
    const result = deriveTrailStatus({ closed_from: '2026-09-01T00:00:00Z' }, NOW)
    expect(result).toEqual({
      state: 'closing_soon',
      title: 'Bald gesperrt',
      dateLine: 'ab 01.09.2026',
      hint: null,
    })
  })

  test('future closed_from with closed_to → closing soon, auto date range line', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-09-01T00:00:00Z', closed_to: '2026-09-15T00:00:00Z' },
      NOW,
    )
    expect(result).toEqual({
      state: 'closing_soon',
      title: 'Bald gesperrt',
      dateLine: 'ab 01.09.2026 bis 15.09.2026',
      hint: null,
    })
  })

  test('expired closed_to → back to open', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-01-01T00:00:00Z', closed_to: '2026-06-01T00:00:00Z' },
      NOW,
    )
    expect(result).toEqual({ state: 'open', title: null, dateLine: null, hint: null })
  })

  test('expired schedule with hint set → still open (schedule wins, ignores hint)', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-01-01T00:00:00Z', closed_to: '2026-06-01T00:00:00Z', hint: 'Winterschaden' },
      NOW,
    )
    expect(result).toEqual({ state: 'open', title: null, dateLine: null, hint: null })
  })

  test('hint-only, no schedule → hint state (closing_soon badge), no date line', () => {
    const result = deriveTrailStatus({ hint: 'Erdrutsch, bitte umfahren' }, NOW)
    expect(result).toEqual({
      state: 'closing_soon',
      title: 'Hinweis',
      dateLine: null,
      hint: 'Erdrutsch, bitte umfahren',
    })
  })

  test('empty-string hint counts as no hint', () => {
    const result = deriveTrailStatus({ hint: '   ' }, NOW)
    expect(result).toEqual({ state: 'open', title: null, dateLine: null, hint: null })
  })

  test('active closure with both a schedule and a hint → date line and hint both present', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-07-01T00:00:00Z', closed_to: '2026-08-15T00:00:00Z', hint: 'Bauarbeiten am Steg' },
      NOW,
    )
    expect(result).toEqual({
      state: 'closed',
      title: 'Aktuell gesperrt',
      dateLine: 'seit 01.07.2026 bis 15.08.2026',
      hint: 'Bauarbeiten am Steg',
    })
  })

  test('future closed_from with a hint → date line and hint both present', () => {
    const result = deriveTrailStatus(
      { closed_from: '2026-09-01T00:00:00Z', hint: 'Forstarbeiten geplant' },
      NOW,
    )
    expect(result).toEqual({
      state: 'closing_soon',
      title: 'Bald gesperrt',
      dateLine: 'ab 01.09.2026',
      hint: 'Forstarbeiten geplant',
    })
  })
})
