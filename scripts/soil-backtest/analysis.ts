/**
 * Pure analysis helpers for the soil backtest — no I/O, no fetch, no Date.now().
 *
 * The backtest asks one question of history we can already download: does the
 * trail-condition model's water bucket dry out at the same speed as the weather
 * model's own soil moisture — and does that speed depend on the soil texture at
 * the spot? Everything that turns numbers into an answer lives here so it can be
 * tested against series with a known answer.
 */

// ── Spots ──────────────────────────────────────────────────────────────────

export interface Spot {
  name: string
  latitude: number
  longitude: number
  totalClicks: number
}

/**
 * Parses the `name,latitude,longitude,total_clicks` list. Deliberately strict:
 * a row with a bad coordinate would otherwise become a request for (NaN, NaN),
 * which Open-Meteo answers with an error that names neither the row nor the spot.
 */
export function parseSpotsCsv(text: string): Spot[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  return lines.slice(1).map((line) => {
    const parts = line.split(',')
    const name = parts[0] ?? ''
    if (parts.length !== 4) throw new Error(`Bad spot row for "${name}": expected 4 columns, got ${parts.length}`)
    const [latitude, longitude, totalClicks] = parts.slice(1).map(Number) as [number, number, number]
    if (![latitude, longitude, totalClicks].every(Number.isFinite)) {
      throw new Error(`Bad spot row for "${name}": non-numeric latitude, longitude or clicks (${line})`)
    }
    return { name, latitude, longitude, totalClicks }
  })
}

// ── Soil texture ───────────────────────────────────────────────────────────

export interface TextureFractions {
  clay: number
  sand: number
  silt: number
}

/**
 * USDA texture class from clay / sand / silt percentages.
 *
 * SoilGrids rounds each fraction on its own, so they rarely add up to exactly
 * 100 — scale them first, otherwise a point near a class boundary flips on
 * rounding noise.
 */
export function usdaTexture(fractions: TextureFractions): string {
  const total = fractions.clay + fractions.sand + fractions.silt
  const c = (fractions.clay / total) * 100
  const sa = (fractions.sand / total) * 100
  const si = (fractions.silt / total) * 100

  if (si + 1.5 * c < 15) return 'sand'
  if (si + 2 * c < 30) return 'loamy sand'
  if ((c >= 7 && c < 20 && sa > 52 && si + 2 * c >= 30) || (c < 7 && si < 50 && si + 2 * c >= 30)) return 'sandy loam'
  if (c >= 7 && c < 27 && si >= 28 && si < 50 && sa <= 52) return 'loam'
  if ((si >= 50 && c >= 12 && c < 27) || (si >= 50 && si < 80 && c < 12)) return 'silt loam'
  if (si >= 80 && c < 12) return 'silt'
  if (c >= 20 && c < 35 && si < 28 && sa > 45) return 'sandy clay loam'
  if (c >= 27 && c < 40 && sa > 20 && sa <= 45) return 'clay loam'
  if (c >= 27 && c < 40 && sa <= 20) return 'silty clay loam'
  if (c >= 35 && sa > 45) return 'sandy clay'
  if (c >= 40 && si >= 40) return 'silty clay'
  if (c >= 40 && sa <= 45 && si < 40) return 'clay'
  return 'unclassified'
}

// ── Aggregation ────────────────────────────────────────────────────────────

/**
 * Mean per calendar day. A day with fewer than `minHours` valid values is
 * dropped rather than averaged: a fragment of a day (the API's current, still
 * incomplete day) would otherwise look like a full one.
 */
export function dailyMean(time: string[], values: (number | null)[], minHours = 18): Map<string, number> {
  const acc = new Map<string, number[]>()
  time.forEach((t, i) => {
    const v = values[i]
    if (typeof v !== 'number' || Number.isNaN(v)) return
    const day = t.slice(0, 10)
    const list = acc.get(day)
    if (list) list.push(v)
    else acc.set(day, [v])
  })
  const out = new Map<string, number>()
  for (const [day, list] of acc) {
    if (list.length >= minHours) out.set(day, list.reduce((a, b) => a + b, 0) / list.length)
  }
  return out
}

/** Sum per calendar day; a missing hour counts as no rain. */
export function dailySum(time: string[], values: (number | null)[]): Map<string, number> {
  const out = new Map<string, number>()
  time.forEach((t, i) => {
    const day = t.slice(0, 10)
    out.set(day, (out.get(day) ?? 0) + (values[i] ?? 0))
  })
  return out
}

// ── Statistics ─────────────────────────────────────────────────────────────

/** Linear-interpolated percentile (the same convention as numpy's default). */
export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return Number.NaN
  const pos = ((sorted.length - 1) * p) / 100
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo)
}

export function median(values: number[]): number | null {
  return values.length === 0 ? null : percentile(values, 50)
}

function ranks(values: number[]): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const out = new Array<number>(values.length)
  for (let start = 0; start < order.length; ) {
    let end = start
    while (end + 1 < order.length && order[end + 1]!.v === order[start]!.v) end++
    const avg = (start + end) / 2 + 1 // ties share the average of their ranks
    for (let k = start; k <= end; k++) out[order[k]!.i] = avg
    start = end + 1
  }
  return out
}

/** Spearman rank correlation, or null when it cannot be computed honestly. */
export function spearman(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 3) return null
  const rx = ranks(x)
  const ry = ranks(y)
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
  const mx = mean(rx)
  const my = mean(ry)
  let cov = 0
  let vx = 0
  let vy = 0
  for (let i = 0; i < rx.length; i++) {
    cov += (rx[i]! - mx) * (ry[i]! - my)
    vx += (rx[i]! - mx) ** 2
    vy += (ry[i]! - my) ** 2
  }
  if (vx === 0 || vy === 0) return null
  return cov / Math.sqrt(vx * vy)
}

// Two-sided 5% critical values of Student's t, df = 1..30.
const T_CRIT_5 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12,
  2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
]

/**
 * |rho| a sample of size n must exceed to differ from zero at the 5% level
 * (t-approximation — accurate enough to tell "clear" from "noise" for n ~ 20).
 */
export function spearmanCritical(n: number): number | null {
  if (n < 3) return null
  const df = n - 2
  const t = df <= T_CRIT_5.length ? T_CRIT_5[df - 1]! : 1.96
  return t / Math.sqrt(df + t * t)
}

export interface Correlation {
  x: string
  y: string
  n: number
  rho: number | null
  critical: number | null
  significant: boolean
}

/** Correlates two columns over the rows where both are present. */
export function correlate<T extends object>(rows: T[], x: keyof T & string, y: keyof T & string): Correlation {
  const xs: number[] = []
  const ys: number[] = []
  for (const row of rows) {
    const a = (row as Record<string, unknown>)[x]
    const b = (row as Record<string, unknown>)[y]
    if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
      xs.push(a)
      ys.push(b)
    }
  }
  const rho = spearman(xs, ys)
  const critical = spearmanCritical(xs.length)
  return { x, y, n: xs.length, rho, critical, significant: rho !== null && critical !== null && Math.abs(rho) >= critical }
}

// ── Dry spells ─────────────────────────────────────────────────────────────

/** Index ranges [start, end] of runs of at least `minLength` days below `dryDayMm`. */
export function findDrySpells(rainMm: number[], opts: { dryDayMm: number; minLength: number }): [number, number][] {
  const spells: [number, number][] = []
  let start = -1
  for (let i = 0; i <= rainMm.length; i++) {
    const dry = i < rainMm.length && rainMm[i]! < opts.dryDayMm
    if (dry && start === -1) start = i
    if (!dry && start !== -1) {
      if (i - start >= opts.minLength) spells.push([start, i - 1])
      start = -1
    }
  }
  return spells
}

/**
 * Days until a series has lost half of its starting value (linear interpolation
 * between days), or null if it starts at or below zero or never gets there.
 */
export function halfLifeDays(values: number[]): number | null {
  if (values.length === 0 || values[0]! <= 0) return null
  const half = values[0]! / 2
  for (let i = 1; i < values.length; i++) {
    if (values[i]! <= half) {
      const prev = values[i - 1]!
      return i - 1 + (prev - half) / (prev - values[i]!)
    }
  }
  return null
}

// ── Per-spot statistics ────────────────────────────────────────────────────

export interface SpotSeries {
  /** Consecutive calendar days, ascending. */
  dates: string[]
  rainMm: number[]
  /** Daily mean soil moisture, m³/m³. */
  moisture: number[]
  /** The trail-condition model's free-water surplus at noon, mm. */
  bucketMm: number[]
}

export interface SpotStats {
  days: number
  moistureP05: number
  moistureP50: number
  moistureP95: number
  /** Do the bucket and the weather model's moisture rise and fall together? */
  bucketMoistureRho: number | null
  /** Median days for the moisture added by a storm to fall by half. */
  moistureHalfLifeDays: number | null
  moistureSpellsUsed: number
  /** Dry-downs that never got back halfway before the next rain. */
  moistureSpellsCensored: number
  bucketHalfLifeDays: number | null
  bucketSpellsUsed: number
  bucketSpellsCensored: number
  /** Median m³/m³ lost per day over the first three dry days after a storm. */
  moistureDropPerDay: number | null
  rainEvents: number
  /** Median moisture gained per mm on a storm day, in percentage points. */
  rainGainPctPerMm: number | null
}

export interface AnalyseOptions {
  /** A day below this counts as dry. */
  dryDayMm?: number
  /** A dry spell must be at least this long to be a dry-down. */
  minSpellDays?: number
  /** A day at or above this counts as a storm. */
  stormMm?: number
  /** A dry-down whose starting excess is below this share of the spot's range is ignored as noise. */
  minExcessShare?: number
  /** A bucket dry-down must start at least this far above its pre-storm level. */
  minBucketExcessMm?: number
}

function nextDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
}

/**
 * Measures how fast a spot dries after storms — for the weather model's soil
 * moisture and for our bucket, the same way, so the two can be compared.
 *
 * Each dry-down is measured against the level on the last dry day BEFORE its
 * storm, not against a global floor: a floor taken from the spot's own history
 * makes a slowly drying spot look fast, because its excess reaches zero by
 * construction. Dry-downs that never reach half before the next rain are
 * counted as censored instead of being dropped, so slow spots stay visible as
 * slow rather than as missing.
 */
export function analyseSpot(series: SpotSeries, opts: AnalyseOptions = {}): SpotStats {
  const { dryDayMm = 0.5, minSpellDays = 4, stormMm = 5, minExcessShare = 0.1, minBucketExcessMm = 1 } = opts
  const { dates, rainMm, moisture, bucketMm } = series
  const n = dates.length
  if (rainMm.length !== n || moisture.length !== n || bucketMm.length !== n) {
    throw new Error('Series have different lengths')
  }
  for (let i = 1; i < n; i++) {
    if (dates[i] !== nextDay(dates[i - 1]!)) {
      throw new Error(`Dates are not contiguous: ${dates[i - 1]} is followed by ${dates[i]}`)
    }
  }

  const p05 = percentile(moisture, 5)
  const p95 = percentile(moisture, 95)
  const minExcess = minExcessShare * (p95 - p05)

  const moistureHalfLives: number[] = []
  const bucketHalfLives: number[] = []
  const drops: number[] = []
  let moistureCensored = 0
  let bucketCensored = 0

  for (const [s, e] of findDrySpells(rainMm, { dryDayMm, minLength: minSpellDays })) {
    // A dry-down needs a storm on the day before the spell and a dry day before
    // that storm to measure against.
    if (s < 2) continue
    if (rainMm[s - 1]! < stormMm || rainMm[s - 2]! >= dryDayMm) continue

    const moistureExcess = moisture.slice(s, e + 1).map((v) => v - moisture[s - 2]!)
    if (moistureExcess[0]! >= minExcess) {
      const hl = halfLifeDays(moistureExcess)
      if (hl === null) moistureCensored++
      else moistureHalfLives.push(hl)
      drops.push((moisture[s]! - moisture[s + 3]!) / 3)
    }

    const bucketExcess = bucketMm.slice(s, e + 1).map((v) => v - bucketMm[s - 2]!)
    if (bucketExcess[0]! >= minBucketExcessMm) {
      const hl = halfLifeDays(bucketExcess)
      if (hl === null) bucketCensored++
      else bucketHalfLives.push(hl)
    }
  }

  const gains: number[] = []
  for (let i = 1; i < n - 1; i++) {
    if (rainMm[i]! >= stormMm) {
      gains.push(((Math.max(moisture[i]!, moisture[i + 1]!) - moisture[i - 1]!) / rainMm[i]!) * 100)
    }
  }

  return {
    days: n,
    moistureP05: p05,
    moistureP50: percentile(moisture, 50),
    moistureP95: p95,
    bucketMoistureRho: spearman(bucketMm, moisture),
    moistureHalfLifeDays: median(moistureHalfLives),
    moistureSpellsUsed: moistureHalfLives.length,
    moistureSpellsCensored: moistureCensored,
    bucketHalfLifeDays: median(bucketHalfLives),
    bucketSpellsUsed: bucketHalfLives.length,
    bucketSpellsCensored: bucketCensored,
    moistureDropPerDay: median(drops),
    rainEvents: gains.length,
    rainGainPctPerMm: median(gains),
  }
}

/**
 * Where each verdict sits inside the spot's own moisture range: 0 is its driest
 * days (5th percentile), 1 its highest (95th). If the verdict ladder means
 * anything, the median position must rise from dusty to wet. Normalised per spot
 * because the weather model's moisture is not comparable in absolute terms
 * between places — it brings its own soil assumptions.
 */
export function normalisedMoistureByLevel(levels: string[], moisture: number[]): Record<string, number> {
  const p05 = percentile(moisture, 5)
  const p95 = percentile(moisture, 95)
  if (!(p95 > p05)) return {} // a spot whose moisture never varies has no scale to place anything on
  const byLevel = new Map<string, number[]>()
  levels.forEach((level, i) => {
    const list = byLevel.get(level) ?? []
    list.push((moisture[i]! - p05) / (p95 - p05))
    byLevel.set(level, list)
  })
  return Object.fromEntries([...byLevel].map(([level, values]) => [level, median(values)!]))
}

/** How many days the model spent in each state. */
export function tallyLevels(levels: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const level of levels) out[level] = (out[level] ?? 0) + 1
  return out
}
