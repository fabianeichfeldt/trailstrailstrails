import { describe, it, expect } from 'vitest'
import {
  formatSpotTable,
  formatCorrelations,
  formatFailures,
  describePeriod,
  describeSpeedRatio,
  formatLadder,
} from './report'
import { correlate } from './analysis'
import type { SpotRow } from './backtest'

function row(name: string, over: Partial<SpotRow> = {}): SpotRow {
  return {
    spot: { name, latitude: 49.9, longitude: 11.5, totalClicks: 100 },
    period: { from: '2026-07-19', to: '2026-09-19' },
    soil: { clay: 24.4, clayQ05: 1.3, clayQ95: 75.3, sand: 33.3, silt: 42.2, cfvo: 13, soc: 26.7, wv0010: 0.423, wv0033: 0.342, wv1500: 0.178 },
    texture: 'loam',
    relSaturation: 0.41,
    pctDaysAboveFieldCapacity: 12.5,
    levels: { prime: 30, damp: 5 },
    moistureByLevel: { prime: 0.3, damp: 0.5 },
    stats: {
      days: 35,
      moistureP05: 0.17, moistureP50: 0.24, moistureP95: 0.32,
      bucketMoistureRho: 0.62,
      moistureHalfLifeDays: 4.2, moistureSpellsUsed: 3, moistureSpellsCensored: 1,
      bucketHalfLifeDays: 2.9, bucketSpellsUsed: 4, bucketSpellsCensored: 0,
      moistureDropPerDay: 0.011,
      rainEvents: 5, rainGainPctPerMm: 1.2,
    },
    ...over,
  }
}

describe('formatSpotTable', () => {
  it('prints one line per spot with texture, clay and the half-lives', () => {
    const text = formatSpotTable([row('Bärenleite - Trails'), row('Back to the roots')])

    expect(text).toContain('Bärenleite - Trails')
    expect(text).toContain('Back to the roots')
    expect(text).toContain('loam')
    expect(text).toContain('24')
    expect(text).toContain('4.2')
    expect(text).toContain('2.9')
    // header row + 2 spots
    expect(text.trim().split('\n').length).toBeGreaterThanOrEqual(3)
  })

  it('shows what it does not know as a dash, not as NaN or undefined', () => {
    const missing = row('No soil', {
      soil: null,
      texture: null,
      relSaturation: null,
      pctDaysAboveFieldCapacity: null,
      stats: { ...row('x').stats, moistureHalfLifeDays: null, bucketHalfLifeDays: null, bucketMoistureRho: null },
    })

    const text = formatSpotTable([missing])

    expect(text).toContain('No soil')
    expect(text).not.toMatch(/NaN|undefined|null/)
    expect(text).toContain('–')
  })

  it('marks soil that was sampled next to the spot because the exact pixel is masked', () => {
    const near = row('Kulmbach', { soil: { ...row('x').soil!, offsetMetres: 300 } })

    const text = formatSpotTable([near, row('Exact')])

    expect(text).toContain('+300 m')
    // Only the moved one carries the note.
    expect(text.match(/\+\d+ m/g)).toHaveLength(1)
  })

  it('flags half-lives that rest on few or censored dry-downs', () => {
    const text = formatSpotTable([row('Few', { stats: { ...row('x').stats, moistureSpellsUsed: 1, moistureSpellsCensored: 2 } })])

    // "1 of 3": one dry-down reached half, two never did within the dry spell.
    expect(text).toMatch(/1\/3/)
  })
})

describe('formatCorrelations', () => {
  it('states n, rho and whether it clears the 5% bar', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => ({ clay: i * 5, t: i }))
    const text = formatCorrelations([correlate(rows, 'clay', 't')], 'clay vs. half-life')

    expect(text).toContain('clay vs. half-life')
    expect(text).toContain('n=10')
    expect(text).toContain('1.00')
    expect(text).toMatch(/significant/i)
  })

  it('says plainly when a correlation is not distinguishable from noise', () => {
    // 12 spots, y alternating 1,2,1,2… against an increasing x: no real relationship.
    const rows = Array.from({ length: 12 }, (_, i) => ({ x: i + 1, y: (i % 2) + 1 }))

    const text = formatCorrelations([correlate(rows, 'x', 'y')], 'noise')

    expect(text).toMatch(/not significant|noise/i)
  })

  it('refuses to call anything significant on fewer than 10 spots, however high rho is', () => {
    // The first live run printed "significant at 5%" for n = 6, rho = 0.89 — one of nine
    // correlations tried on a handful of spots. That is a coin-flip, not a finding.
    const rows = [1, 2, 3, 4, 5, 6].map((i) => ({ clay: i * 10, drop: i }))

    const text = formatCorrelations([correlate(rows, 'clay', 'drop')], 'small sample')

    expect(text).toContain('n=6')
    expect(text).toMatch(/too few/i)
    expect(text).not.toMatch(/significant at 5%/i)
  })

  it('reminds the reader that several correlations were tried at once', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ a: i, b: i }))

    const text = formatCorrelations([correlate(rows, 'a', 'b'), correlate(rows, 'b', 'a')], 'many')

    expect(text).toMatch(/2 correlations/i)
  })
})

describe('describeSpeedRatio', () => {
  it('refuses to state a ratio from a handful of spots — the live run had measurable dry-downs at only 2 of 20', () => {
    const text = describeSpeedRatio([0.5, 0.6])

    expect(text).toMatch(/too few/i)
    expect(text).toContain('2')
    expect(text).not.toMatch(/\dx|×/)
  })

  it('states the median ratio once there are enough spots, and which way it points', () => {
    const slower = describeSpeedRatio([1.5, 2, 2.5, 2, 1.8, 2.2, 2.1, 1.9, 2.4, 2.0])
    const faster = describeSpeedRatio([0.4, 0.5, 0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0.5, 0.5])

    expect(slower).toMatch(/2\.0.*longer|longer.*2\.0/i)
    expect(faster).toMatch(/0\.5.*(shorter|faster)|(shorter|faster).*0\.5/i)
  })
})

describe('formatLadder', () => {
  const at = (m: Record<string, number>) => row('x', { moistureByLevel: m })

  it('shows where each verdict sits in the moisture range and confirms when it rises with the verdict', () => {
    const text = formatLadder([
      at({ dusty: 0.1, prime: 0.3, damp: 0.5, wet: 0.8 }),
      at({ dusty: 0.2, prime: 0.35, damp: 0.6, wet: 0.9 }),
    ])

    expect(text).toContain('dusty')
    expect(text).toContain('wet')
    expect(text).toMatch(/rises with the verdict: yes/i)
  })

  it('says plainly when the ladder is out of order — that would be a model problem', () => {
    const text = formatLadder([at({ dusty: 0.1, prime: 0.6, damp: 0.4, wet: 0.8 })])

    expect(text).toMatch(/rises with the verdict: no/i)
    expect(text).toMatch(/prime.*damp|damp.*prime/)
  })

  it('leaves out a level nobody reached instead of printing NaN', () => {
    const text = formatLadder([at({ prime: 0.3, damp: 0.5 })])

    expect(text).not.toMatch(/NaN|undefined/)
    expect(text).not.toContain('wet')
  })
})

describe('describePeriod', () => {
  it('names the days the numbers rest on, and how many', () => {
    const text = describePeriod([row('A'), row('B')])

    expect(text).toContain('2026-07-19')
    expect(text).toContain('2026-09-19')
    expect(text).toContain('63 days')
  })

  it('says so when spots cover different periods instead of pretending they share one', () => {
    const shorter = row('Short', { period: { from: '2026-08-01', to: '2026-09-19' } })

    const text = describePeriod([row('A'), shorter])

    expect(text).toContain('2026-07-19')
    expect(text).toMatch(/differs|varies/i)
  })
})

describe('formatFailures', () => {
  it('lists which spots failed and why, so a partial run is never mistaken for a full one', () => {
    const text = formatFailures([{ name: 'Woodpecker - Trail', step: 'SoilGrids', message: 'HTTP 503' }])

    expect(text).toContain('Woodpecker - Trail')
    expect(text).toContain('SoilGrids')
    expect(text).toContain('HTTP 503')
  })

  it('is empty when nothing failed', () => {
    expect(formatFailures([])).toBe('')
  })
})
