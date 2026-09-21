import { describe, it, expect } from 'vitest'
import {
  parseSpotsCsv,
  usdaTexture,
  dailyMean,
  dailySum,
  median,
  percentile,
  spearman,
  spearmanCritical,
  correlate,
  findDrySpells,
  halfLifeDays,
  analyseSpot,
  tallyLevels,
  normalisedMoistureByLevel,
  type SpotSeries,
} from './analysis'

describe('parseSpotsCsv', () => {
  it('reads name, coordinates and clicks, keeping umlauts and dashes in names', () => {
    const spots = parseSpotsCsv(
      'name,latitude,longitude,total_clicks\nBärenleite - Trails,49.9128,11.5604,514\nBack to the roots,47.7389,11.8896,465\n',
    )

    expect(spots).toEqual([
      { name: 'Bärenleite - Trails', latitude: 49.9128, longitude: 11.5604, totalClicks: 514 },
      { name: 'Back to the roots', latitude: 47.7389, longitude: 11.8896, totalClicks: 465 },
    ])
  })

  it('ignores blank lines and rejects a row with a non-numeric coordinate', () => {
    expect(parseSpotsCsv('name,latitude,longitude,total_clicks\n\nA,1,2,3\n')).toHaveLength(1)
    expect(() => parseSpotsCsv('name,latitude,longitude,total_clicks\nA,north,2,3\n')).toThrow(/A/)
  })

  it('loads the shipped 20-spot list', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const text = readFileSync(resolve(__dirname, 'spots.csv'), 'utf8')

    const spots = parseSpotsCsv(text)

    expect(spots).toHaveLength(20)
    expect(spots.map((s) => s.name)).toContain('Bärenleite - Trails')
  })
})

describe('usdaTexture', () => {
  it.each([
    // The real SoilGrids reading at Bärenleite, 5-15 cm.
    [{ clay: 24.4, sand: 33.3, silt: 42.2 }, 'loam'],
    [{ clay: 5, sand: 90, silt: 5 }, 'sand'],
    [{ clay: 5, sand: 82, silt: 13 }, 'loamy sand'],
    [{ clay: 10, sand: 65, silt: 25 }, 'sandy loam'],
    [{ clay: 15, sand: 20, silt: 65 }, 'silt loam'],
    [{ clay: 6, sand: 10, silt: 84 }, 'silt'],
    [{ clay: 25, sand: 60, silt: 15 }, 'sandy clay loam'],
    [{ clay: 33, sand: 30, silt: 37 }, 'clay loam'],
    [{ clay: 33, sand: 15, silt: 52 }, 'silty clay loam'],
    [{ clay: 40, sand: 50, silt: 10 }, 'sandy clay'],
    [{ clay: 45, sand: 10, silt: 45 }, 'silty clay'],
    [{ clay: 60, sand: 20, silt: 20 }, 'clay'],
  ])('classifies %j as %s', (fractions, expected) => {
    expect(usdaTexture(fractions)).toBe(expected)
  })

  it('normalises fractions that do not add up to exactly 100', () => {
    // SoilGrids rounds each fraction on its own; 24.1 + 33.5 + 42.3 = 99.9.
    expect(usdaTexture({ clay: 24.1, sand: 33.5, silt: 42.3 })).toBe('loam')
    expect(usdaTexture({ clay: 48.8, sand: 66.6, silt: 84.4 })).toBe('loam')
  })
})

describe('daily aggregation', () => {
  const time = ['2026-09-01T00:00', '2026-09-01T12:00', '2026-09-02T00:00', '2026-09-02T12:00']

  it('averages hourly values per calendar day', () => {
    const means = dailyMean(time, [0.2, 0.4, 0.1, 0.3], 1)

    expect(means.get('2026-09-01')).toBeCloseTo(0.3)
    expect(means.get('2026-09-02')).toBeCloseTo(0.2)
  })

  it('sums hourly rain per day', () => {
    const sums = dailySum(time, [1, 2, 0, 0.5])

    expect(sums.get('2026-09-01')).toBe(3)
    expect(sums.get('2026-09-02')).toBe(0.5)
  })

  it('drops a day that has too few valid hours instead of averaging a fragment', () => {
    const means = dailyMean(time, [0.2, null, 0.1, 0.3], 2)

    expect(means.has('2026-09-01')).toBe(false)
    expect(means.get('2026-09-02')).toBeCloseTo(0.2)
  })
})

describe('median / percentile', () => {
  it('takes the middle value, or the mean of the two middle ones', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNull()
  })

  it('interpolates percentiles linearly', () => {
    expect(percentile([0, 10, 20, 30, 40], 50)).toBe(20)
    expect(percentile([0, 10], 25)).toBe(2.5)
    expect(percentile([0, 10, 20, 30, 40], 100)).toBe(40)
  })
})

describe('spearman', () => {
  it('is 1 for any increasing relationship, not just a linear one', () => {
    expect(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 100])).toBeCloseTo(1)
  })

  it('is -1 for a decreasing one', () => {
    expect(spearman([1, 2, 3, 4], [9, 7, 3, 1])).toBeCloseTo(-1)
  })

  it('handles ties with average ranks', () => {
    // x has a tie; y increases with x, so the correlation is high but not 1.
    const rho = spearman([1, 2, 2, 3], [1, 2, 3, 4])!

    expect(rho).toBeGreaterThan(0.85)
    expect(rho).toBeLessThan(1)
  })

  it('returns null when it cannot say anything', () => {
    expect(spearman([1, 2], [1, 2])).toBeNull() // too few points
    expect(spearman([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull() // no variation in x
  })
})

describe('spearmanCritical / correlate', () => {
  it('gives the textbook 5% threshold for n = 20', () => {
    expect(spearmanCritical(20)).toBeCloseTo(0.444, 2)
  })

  it('needs a much stronger correlation from a small sample', () => {
    expect(spearmanCritical(6)!).toBeGreaterThan(0.8)
    expect(spearmanCritical(2)).toBeNull()
  })

  it('pairs up rows, skips missing values and flags significance', () => {
    const rows = [
      { clay: 10, t: 1 },
      { clay: 20, t: 2 },
      { clay: 30, t: 3 },
      { clay: 40, t: 4 },
      { clay: 50, t: 5 },
      { clay: 60, t: 6 },
      { clay: null, t: 7 },
    ]

    const result = correlate(rows, 'clay', 't')

    expect(result.n).toBe(6)
    expect(result.rho).toBeCloseTo(1)
    expect(result.significant).toBe(true)
  })

  it('does not call a weak correlation significant', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ x: i, y: [3, 1, 4, 1, 5, 9, 2, 6][i - 1]! }))

    expect(correlate(rows, 'x', 'y').significant).toBe(false)
  })
})

describe('findDrySpells', () => {
  it('finds runs of dry days at least minLength long', () => {
    //            0  1  2    3    4    5    6    7    8
    const rain = [5, 0, 0.1, 0, 0, 0.2, 9, 0, 0]

    const spells = findDrySpells(rain, { dryDayMm: 0.5, minLength: 4 })

    expect(spells).toEqual([[1, 5]])
  })

  it('reports every qualifying spell and ignores short ones', () => {
    const rain = [0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0]

    expect(findDrySpells(rain, { dryDayMm: 0.5, minLength: 4 })).toEqual([
      [0, 3],
      [8, 12],
    ])
  })
})

describe('halfLifeDays', () => {
  it('interpolates when the value crosses half of its starting level', () => {
    // 8 -> 6 -> 3: half (4) is crossed between day 1 (6) and day 2 (3), at 1 + 2/3.
    expect(halfLifeDays([8, 6, 3])).toBeCloseTo(1 + 2 / 3)
  })

  it('returns null for a series that never halves, or does not start above zero', () => {
    expect(halfLifeDays([8, 7, 6])).toBeNull()
    expect(halfLifeDays([0, 0, 0])).toBeNull()
    expect(halfLifeDays([-1, -2])).toBeNull()
  })
})

// ── analyseSpot ────────────────────────────────────────────────────────────
// Each dry-down is measured against the level just BEFORE its storm, so no
// global "floor" is needed - a global floor would make every slowly drying spot
// look fast, because its excess reaches zero by construction.
//
// Synthetic spot: moisture relaxes exponentially towards FLOOR after each storm
// with a KNOWN half-life, so the fitted number can be checked by hand. Storms
// fall on days 0, 14 and 28; day 0 has no day before it, so two events count.

const FLOOR = 0.15
const PEAK = 0.35
const HALF_LIFE = 3 // days
const K = Math.LN2 / HALF_LIFE

function synthetic(spec: { halfLife?: number; days?: number } = {}): SpotSeries {
  const k = Math.LN2 / (spec.halfLife ?? HALF_LIFE)
  const n = spec.days ?? 40
  const dates: string[] = []
  const rainMm: number[] = []
  const moisture: number[] = []
  const bucketMm: number[] = []
  let daysSinceStorm = 0
  for (let i = 0; i < n; i++) {
    const storm = i % 14 === 0
    if (storm) daysSinceStorm = 0
    else daysSinceStorm++
    dates.push(new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10))
    rainMm.push(storm ? 12 : 0)
    moisture.push(FLOOR + (PEAK - FLOOR) * Math.exp(-k * daysSinceStorm))
    bucketMm.push(Math.max(0, 8 - daysSinceStorm * 1.5))
  }
  return { dates, rainMm, moisture, bucketMm }
}

/** A hand-built series: dry, one 12 mm storm on day 3, then a dry-down. */
function oneStorm(moistureAfter: number[]): SpotSeries {
  const moisture = [0.15, 0.15, 0.15, 0.35, ...moistureAfter]
  const n = moisture.length
  return {
    dates: Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10)),
    rainMm: moisture.map((_, i) => (i === 3 ? 12 : 0)),
    moisture,
    bucketMm: moisture.map(() => 0),
  }
}

describe('analyseSpot', () => {
  it('recovers a known moisture half-life from a synthetic dry-down', () => {
    const stats = analyseSpot(synthetic())

    expect(stats.moistureSpellsUsed).toBe(2)
    // The pre-storm level is the tail of the previous recession, not the floor,
    // so the answer sits a little under the true 3 days.
    expect(stats.moistureHalfLifeDays).not.toBeNull()
    expect(stats.moistureHalfLifeDays!).toBeCloseTo(HALF_LIFE, 0)
  })

  it('finds slower drying as a longer half-life', () => {
    const fast = analyseSpot(synthetic({ halfLife: 2 }))
    const slow = analyseSpot(synthetic({ halfLife: 5 }))

    expect(slow.moistureHalfLifeDays!).toBeGreaterThan(fast.moistureHalfLifeDays!)
  })

  it('measures the bucket the same way, so the two can be compared', () => {
    const stats = analyseSpot(synthetic())

    // After each storm the bucket reads 6.5 on the first dry day, then 5, 3.5, 2 ...
    // Half of 6.5 is 3.25, crossed between day 2 (3.5) and day 3 (2).
    expect(stats.bucketHalfLifeDays!).toBeCloseTo(2 + (3.5 - 3.25) / 1.5, 2)
  })

  it('reports the drop per day over the first three dry days', () => {
    const stats = analyseSpot(synthetic())
    // First dry day is t = 1 days after the storm; three days later is t = 4.
    const expected = ((PEAK - FLOOR) * (Math.exp(-K) - Math.exp(-4 * K))) / 3

    expect(stats.moistureDropPerDay!).toBeCloseTo(expected, 3)
  })

  it('measures how much moisture a rain day adds per mm', () => {
    const stats = analyseSpot(synthetic())
    // Storm day 14: moisture jumps from its day-13 level to PEAK on 12 mm.
    const day13 = FLOOR + (PEAK - FLOOR) * Math.exp(-13 * (Math.LN2 / HALF_LIFE))
    const expected = ((PEAK - day13) / 12) * 100

    expect(stats.rainEvents).toBe(2)
    expect(stats.rainGainPctPerMm!).toBeCloseTo(expected, 1)
  })

  it('counts a spell that never reached half instead of silently dropping it', () => {
    // Storm lifts 0.15 -> 0.35, then it barely drops for 5 dry days.
    const stats = analyseSpot(oneStorm([0.35, 0.349, 0.348, 0.347, 0.346]))

    expect(stats.moistureHalfLifeDays).toBeNull()
    expect(stats.moistureSpellsUsed).toBe(0)
    expect(stats.moistureSpellsCensored).toBe(1)
  })

  it('ignores a dry-down that starts from almost no excess', () => {
    // A 12 mm storm that barely moved the soil says nothing about drying speed.
    const stats = analyseSpot(oneStorm([0.152, 0.151, 0.15, 0.15, 0.15]))

    expect(stats.moistureSpellsUsed + stats.moistureSpellsCensored).toBe(0)
  })

  it('does not treat a spell without a storm before it as a dry-down', () => {
    // 40 dry days from the start: no storm precedes any spell.
    const n = 40
    const stats = analyseSpot({
      dates: Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10)),
      rainMm: Array(n).fill(0),
      moisture: Array.from({ length: n }, (_, i) => 0.3 - i * 0.002),
      bucketMm: Array(n).fill(0),
    })

    expect(stats.moistureHalfLifeDays).toBeNull()
    expect(stats.moistureSpellsUsed + stats.moistureSpellsCensored).toBe(0)
  })

  it('correlates the bucket with moisture over the whole period', () => {
    const stats = analyseSpot(synthetic())

    expect(stats.bucketMoistureRho!).toBeGreaterThan(0.7)
  })

  it('reports the moisture range the spot actually spans', () => {
    const stats = analyseSpot(synthetic())

    expect(stats.moistureP05).toBeGreaterThanOrEqual(FLOOR)
    expect(stats.moistureP95).toBeLessThanOrEqual(PEAK)
    expect(stats.moistureP50).toBeGreaterThan(stats.moistureP05)
  })

  it('refuses a series with a gap in its dates', () => {
    const series = synthetic()
    series.dates[5] = '2026-08-30'

    expect(() => analyseSpot(series)).toThrow(/contiguous|gap/i)
  })
})

describe('normalisedMoistureByLevel', () => {
  it("places each verdict inside the spot's own moisture range, 0 = driest days and 1 = wettest", () => {
    // Moisture 0, .25, .5, .75, 1 with p05 = .05 and p95 = .95, so a value v maps to (v - .05) / .9.
    const result = normalisedMoistureByLevel(['dusty', 'prime', 'prime', 'damp', 'wet'], [0, 0.25, 0.5, 0.75, 1])

    expect(result.dusty!).toBeLessThan(result.prime!)
    expect(result.prime!).toBeLessThan(result.damp!)
    expect(result.damp!).toBeLessThan(result.wet!)
    // Median of (.25 -> .222) and (.5 -> .5).
    expect(result.prime!).toBeCloseTo(0.361, 2)
  })

  it('says nothing for a spot whose moisture never varies, instead of dividing by zero', () => {
    expect(normalisedMoistureByLevel(['prime', 'damp'], [0.2, 0.2])).toEqual({})
  })
})

describe('tallyLevels', () => {
  it('counts how many days the model spent in each state', () => {
    expect(tallyLevels(['prime', 'prime', 'damp', 'wet', 'prime'])).toEqual({ prime: 3, damp: 1, wet: 1 })
  })
})
