// @vitest-environment node
import { describe, test, expect } from 'vitest'
import { computeTrailStats, trailTooltipHtml, DIFF_COLOR, placeholderDesc } from './trailTooltip'

const SAMPLE_POINTS: [number, number, number][] = [
  [50.1, 11.4, 400],
  [50.101, 11.401, 430],
  [50.102, 11.402, 420],
  [50.103, 11.403, 450],
  [50.104, 11.404, 410],
]

describe('computeTrailStats', () => {
  test('returns zero stats for fewer than 2 points', () => {
    const stats = computeTrailStats([[50, 11, 400]])
    expect(stats.distanceKm).toBe('0.0')
    expect(stats.elevGain).toBe(0)
    expect(stats.elevLoss).toBe(0)
    expect(stats.profilePath).toBe('')
  })

  test('calculates distance > 0 for real points', () => {
    const stats = computeTrailStats(SAMPLE_POINTS)
    expect(parseFloat(stats.distanceKm)).toBeGreaterThan(0)
  })

  test('calculates elevation gain and loss correctly', () => {
    const stats = computeTrailStats(SAMPLE_POINTS)
    // gains: +30 (400→430), +30 (420→450) = 60
    // losses: -10 (430→420), -40 (450→410) = 50
    expect(stats.elevGain).toBe(60)
    expect(stats.elevLoss).toBe(50)
  })

  test('profile path starts with M0 and ends with Z', () => {
    const stats = computeTrailStats(SAMPLE_POINTS)
    expect(stats.profilePath).toMatch(/^M0,/)
    expect(stats.profilePath).toMatch(/Z$/)
  })
})

describe('trailTooltipHtml', () => {
  test('uses difficulty color as CSS custom property', () => {
    const stats = computeTrailStats(SAMPLE_POINTS)
    const html = trailTooltipHtml('Test Trail', 'red', 'A red trail.', stats)
    expect(html).toContain(`--ttr-color:${DIFF_COLOR.red}`)
  })

  test('shows Tour label when difficulty is null', () => {
    const stats = computeTrailStats(SAMPLE_POINTS)
    const html = trailTooltipHtml('Rundkurs', null, 'A tour.', stats)
    expect(html).toContain('Tour')
    expect(html).not.toContain('undefined')
  })

  test('includes elevation profile SVG when points exist', () => {
    const stats = computeTrailStats(SAMPLE_POINTS)
    const html = trailTooltipHtml('Test', 'blue', 'desc', stats)
    expect(html).toContain('<svg')
    expect(html).toContain('ttr-chart')
  })

  test('includes distance, gain and loss stats', () => {
    const stats = computeTrailStats(SAMPLE_POINTS)
    const html = trailTooltipHtml('Test', 'green', 'desc', stats)
    expect(html).toContain(stats.distanceKm)
    expect(html).toContain(String(stats.elevGain))
    expect(html).toContain(String(stats.elevLoss))
  })
})

describe('DIFF_COLOR', () => {
  test('has entries for all four difficulty levels', () => {
    expect(DIFF_COLOR).toHaveProperty('green')
    expect(DIFF_COLOR).toHaveProperty('blue')
    expect(DIFF_COLOR).toHaveProperty('red')
    expect(DIFF_COLOR).toHaveProperty('black')
  })
})

describe('placeholderDesc', () => {
  test('returns a non-empty string for known difficulties', () => {
    for (const d of ['green', 'blue', 'red', 'black']) {
      expect(placeholderDesc(d).length).toBeGreaterThan(10)
    }
  })

  test('returns fallback for unknown difficulty', () => {
    expect(placeholderDesc('purple')).toContain('Trail')
  })
})
