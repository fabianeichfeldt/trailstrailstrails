/** Plain-text report for the terminal — pure string building, no I/O. */
import type { Correlation } from './analysis'
import type { SpotRow } from './backtest'

export interface Failure {
  name: string
  step: string
  message: string
}

const DASH = '–'

function num(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value) ? DASH : value.toFixed(digits)
}

/** "4.2 (3/4)": the half-life, and how many of the dry-downs actually reached half. */
function halfLife(value: number | null, used: number, censored: number): string {
  const total = used + censored
  return total === 0 ? DASH : `${num(value)} (${used}/${total})`
}

function table(header: string[], rows: string[][]): string {
  const widths = header.map((h, c) => Math.max(h.length, ...rows.map((r) => r[c]!.length)))
  const line = (cells: string[]) => cells.map((cell, c) => cell.padEnd(widths[c]!)).join('  ').trimEnd()
  return [line(header), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n')
}

export function formatSpotTable(rows: SpotRow[]): string {
  const header = [
    'Spot', 'texture', 'clay % (5–95%)', 'stones %', 'SOC g/kg', 'moist. p50', 'rel.sat', '% > FC',
    't½ moisture d (n)', 't½ bucket d (n)', 'ρ bucket~moist.', 'model days',
  ]
  const body = rows.map((r) => {
    const s = r.stats
    const clay = r.soil
      ? `${num(r.soil.clay, 0)} (${num(r.soil.clayQ05, 0)}–${num(r.soil.clayQ95, 0)})`
      : DASH
    const levels = Object.entries(r.levels)
      .sort((a, b) => b[1] - a[1])
      .map(([level, days]) => `${level} ${days}`)
      .join(', ')
    return [
      r.spot.name,
      r.texture ? `${r.texture}${r.soil?.offsetMetres ? ` (+${r.soil.offsetMetres} m)` : ''}` : DASH,
      clay,
      num(r.soil?.cfvo, 0),
      num(r.soil?.soc, 0),
      num(s.moistureP50, 3),
      num(r.relSaturation, 2),
      num(r.pctDaysAboveFieldCapacity, 0),
      halfLife(s.moistureHalfLifeDays, s.moistureSpellsUsed, s.moistureSpellsCensored),
      halfLife(s.bucketHalfLifeDays, s.bucketSpellsUsed, s.bucketSpellsCensored),
      num(s.bucketMoistureRho, 2),
      levels || DASH,
    ]
  })
  return table(header, body)
}

/**
 * Below this many spots no correlation is reported as significant. The first live
 * run printed "significant at 5%" for n = 6 — one of nine correlations tried on a
 * handful of spots, which is a coin-flip rather than a finding.
 */
const MIN_SPOTS_TO_CONCLUDE = 10

export function formatCorrelations(correlations: Correlation[], title: string): string {
  const lines = correlations.map((c) => {
    const label = `${c.x} ~ ${c.y}`
    if (c.rho === null || c.critical === null) return `  ${label}: n=${c.n}, not enough data`
    const rho = `rho=${c.rho.toFixed(2)}`
    if (c.n < MIN_SPOTS_TO_CONCLUDE) {
      return `  ${label}: n=${c.n}, ${rho} → too few spots to conclude anything (need at least ${MIN_SPOTS_TO_CONCLUDE})`
    }
    const verdict = c.significant
      ? `significant at 5% (needs |rho| ≥ ${c.critical.toFixed(2)})`
      : `not significant — indistinguishable from noise at this n (needs |rho| ≥ ${c.critical.toFixed(2)})`
    return `  ${label}: n=${c.n}, ${rho} → ${verdict}`
  })
  // Trying several correlations at once makes a lucky one likely — say so where it is read.
  const caveat =
    correlations.length > 1
      ? [`  (${correlations.length} correlations tried: at the 5% level about ${(correlations.length * 0.05).toFixed(1)} would look significant by chance alone.)`]
      : []
  return [title, ...lines, ...caveat].join('\n')
}

const MIN_SPOTS_FOR_RATIO = 10

/**
 * How fast the weather model's soil dries relative to our bucket. Only stated
 * with enough spots: the first live run had a measurable dry-down at 2 of 20
 * spots, and "0.5x, median over 2 spots" was printed as if it meant something.
 */
export function describeSpeedRatio(ratios: number[]): string {
  if (ratios.length < MIN_SPOTS_FOR_RATIO) {
    return `Too few spots (${ratios.length}) had a measurable dry-down in both the weather model and our bucket to compare their speed — at least ${MIN_SPOTS_FOR_RATIO} needed.`
  }
  const sorted = [...ratios].sort((a, b) => a - b)
  const mid = sorted.length / 2
  const median = sorted.length % 2 ? sorted[Math.floor(mid)]! : (sorted[mid - 1]! + sorted[mid]!) / 2
  return median >= 1
    ? `The weather model's soil takes ${median.toFixed(1)}× longer than our bucket to lose half of a storm's water (median over ${ratios.length} spots).`
    : `The weather model's soil dries faster than our bucket: it loses half of a storm's water in ${median.toFixed(1)}× the time (median over ${ratios.length} spots).`
}

const LADDER = ['dusty', 'prime', 'damp', 'wet']

/**
 * Does moisture rise with the verdict? Pools each level's position across spots
 * (one vote per spot) and checks the order dusty < prime < damp < wet. An
 * out-of-order ladder would be a problem in the model, not in the data.
 */
export function formatLadder(rows: SpotRow[]): string {
  const points = LADDER.map((level) => {
    const values = rows.map((r) => r.moistureByLevel[level]).filter((v): v is number => typeof v === 'number')
    const sorted = [...values].sort((a, b) => a - b)
    const mid = sorted.length / 2
    const median = sorted.length === 0 ? null : sorted.length % 2 ? sorted[Math.floor(mid)]! : (sorted[mid - 1]! + sorted[mid]!) / 2
    return { level, median, spots: values.length }
  }).filter((p): p is { level: string; median: number; spots: number } => p.median !== null)

  const violation = points.find((p, i) => i > 0 && p.median <= points[i - 1]!.median)
  const previous = violation ? points[points.indexOf(violation) - 1]! : null
  return [
    "Verdict vs. soil moisture (median position in each spot's own range: 0 = its driest days, 1 = its highest)",
    `  ${points.map((p) => `${p.level} ${p.median.toFixed(2)} (${p.spots} spots)`).join('  →  ')}`,
    violation && previous
      ? `  moisture rises with the verdict: no — ${previous.level} (${previous.median.toFixed(2)}) is not below ${violation.level} (${violation.median.toFixed(2)})`
      : '  moisture rises with the verdict: yes',
  ].join('\n')
}

/** "2026-07-19 to 2026-09-19 (63 days)" — the days the numbers rest on. */
export function describePeriod(rows: SpotRow[]): string {
  const from = rows.map((r) => r.period.from).sort()[0]!
  const to = rows.map((r) => r.period.to).sort().at(-1)!
  const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000 + 1
  const lengths = rows.map((r) => days(r.period.from, r.period.to))
  const shortest = Math.min(...lengths)
  const longest = Math.max(...lengths)
  const same = rows.every((r) => r.period.from === from && r.period.to === to)
  return same
    ? `${from} to ${to} (${days(from, to)} days)`
    : `${from} to ${to} — period differs by spot (${shortest}–${longest} days each)`
}

/** Empty when nothing failed, so a clean run prints nothing extra. */
export function formatFailures(failures: Failure[]): string {
  if (failures.length === 0) return ''
  return ['Spots that could not be fully processed:', ...failures.map((f) => `  ${f.name} — ${f.step}: ${f.message}`)].join('\n')
}
