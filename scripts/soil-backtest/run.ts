/**
 * Soil backtest — does the trail-condition model dry out like the weather
 * model's own soil moisture, and does that depend on the soil texture at the spot?
 *
 *   npm run backtest:soil                      # all spots in spots.csv
 *   npm run backtest:soil -- --limit=3         # first three only, to try it out
 *   npm run backtest:soil -- --refresh         # ignore the cache, fetch everything again
 *   npm run backtest:soil -- --layer=soil_moisture_1_to_3cm
 *   npm run backtest:soil -- --storm-mm=3 --min-dry-days=3   # search dry-downs more loosely
 *
 * A dry-down is a storm (default 5 mm) followed by at least 4 dry days (< 0.5 mm),
 * with a dry day before the storm to measure against. In ~60 summer days few
 * spots have one; loosen the thresholds to get more, at the price of noisier ones.
 *
 * Needs no credentials and touches no database: it only reads two public APIs
 * (SoilGrids, Open-Meteo). Responses are cached on disk — SoilGrids is a slow
 * beta service, and a rerun should not hit it again for data that never changes.
 * Every run writes a NEW file to scripts/soil-backtest/results/ — named after the
 * period it covers and a timestamp — and never overwrites one: the forecast
 * endpoint's 92-day window slides, so a run cannot be reproduced later. The
 * cache (default ~/.cache/trailradar-soil-backtest) is never a place for results.
 *
 * Run through vite-node so it can import the app's real model via the `~/` alias;
 * plain `node scripts/soil-backtest/run.ts` cannot resolve that.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { correlate, parseSpotsCsv, type AnalyseOptions, type Correlation } from './analysis'
import { buildSpotRow, buildSpotSeries, type SpotRow } from './backtest'
import { nonClobberingPath, resultFileName } from './output'
import {
  describePeriod,
  describeSpeedRatio,
  formatCorrelations,
  formatFailures,
  formatLadder,
  formatSpotTable,
  type Failure,
} from './report'
import { fetchHistory, fetchSoilProfileNear, MOISTURE_LAYERS, type FetchDeps, type SoilProfile } from './sources'

// ── Arguments ──────────────────────────────────────────────────────────────

const args = new Map<string, string>()
for (const arg of process.argv.slice(2)) {
  if (!arg.startsWith('--')) continue
  const [key, value] = arg.slice(2).split('=')
  args.set(key!, value ?? 'true')
}

const layer = args.get('layer') ?? 'soil_moisture_3_to_9cm'
if (!(MOISTURE_LAYERS as readonly string[]).includes(layer)) {
  console.error(`Unknown --layer "${layer}". Choose one of: ${MOISTURE_LAYERS.join(', ')}`)
  process.exit(1)
}
const limit = args.has('limit') ? Number(args.get('limit')) : Infinity
const refresh = args.has('refresh')
const pauseMs = Number(args.get('pause-ms') ?? 1000)
// Outside the repo and outside any one worktree: the SoilGrids part took ~20 min and
// never changes, and this is meant to be run again weeks later, possibly from a
// different checkout. The OS temp dir is not a safe place for that.
const cacheDir = args.get('cache') ?? join(homedir(), '.cache', 'trailradar-soil-backtest')
// Inside the repo, so results can be committed and travel with the branch.
const resultsDir = fileURLToPath(new URL('./results', import.meta.url))
const spotsFile = args.get('spots') ?? fileURLToPath(new URL('./spots.csv', import.meta.url))
const analyse: AnalyseOptions = {
  ...(args.has('storm-mm') && { stormMm: Number(args.get('storm-mm')) }),
  ...(args.has('min-dry-days') && { minSpellDays: Number(args.get('min-dry-days')) }),
}

// ── Cache ──────────────────────────────────────────────────────────────────

mkdirSync(cacheDir, { recursive: true })

/** Reads a cached JSON file, or computes and stores it. `today` in the key keeps weather fresh; soil never changes. */
async function cached<T>(file: string, produce: () => Promise<T>): Promise<{ value: T; fromCache: boolean }> {
  const path = join(cacheDir, file)
  if (!refresh && existsSync(path)) return { value: JSON.parse(readFileSync(path, 'utf8')) as T, fromCache: true }
  const value = await produce()
  writeFileSync(path, JSON.stringify(value))
  return { value, fromCache: false }
}

// ── Run ────────────────────────────────────────────────────────────────────

const deps: FetchDeps = {
  fetch: (url, init) => fetch(url, init),
  sleep: (ms) => sleep(ms),
}

const spots = parseSpotsCsv(readFileSync(spotsFile, 'utf8')).slice(0, limit)
const today = new Date().toISOString().slice(0, 10)
const rows: SpotRow[] = []
const failures: Failure[] = []

console.error(`Backtest: ${spots.length} spots, layer ${layer}, cache ${cacheDir}\n`)

for (const [i, spot] of spots.entries()) {
  const tag = `[${i + 1}/${spots.length}] ${spot.name}`
  const key = `${spot.latitude}_${spot.longitude}`

  let soil: SoilProfile | null = null
  let soilNote: string
  try {
    const result = await cached(`soilgrids-${key}.json`, () => fetchSoilProfileNear(spot.latitude, spot.longitude, deps, { pauseMs }))
    soil = result.value
    soilNote = result.fromCache ? 'soil (cached)' : 'soil (fetched)'
  } catch (error) {
    // A missing soil profile costs this spot its texture columns, not the whole run.
    soilNote = 'soil FAILED'
    failures.push({ name: spot.name, step: 'SoilGrids', message: error instanceof Error ? error.message : String(error) })
  }

  try {
    const history = await cached(`history-${today}-${key}.json`, () => fetchHistory(spot.latitude, spot.longitude, deps))
    rows.push(buildSpotRow(spot, soil, buildSpotSeries(history.value, layer), analyse))
    console.error(`${tag}: ${soilNote}, history ${history.fromCache ? '(cached)' : '(fetched)'}`)
  } catch (error) {
    // Without weather history there is nothing to analyse for this spot.
    console.error(`${tag}: ${soilNote}, history FAILED`)
    failures.push({ name: spot.name, step: 'Open-Meteo / model', message: error instanceof Error ? error.message : String(error) })
  }
}

if (rows.length === 0) {
  console.error('\nNo spot could be processed.')
  console.error(formatFailures(failures))
  process.exit(1)
}

// ── Report ─────────────────────────────────────────────────────────────────

const flat = rows.map((r) => ({
  clay: r.soil?.clay ?? null,
  sand: r.soil?.sand ?? null,
  stones: r.soil?.cfvo ?? null,
  soc: r.soil?.soc ?? null,
  relSat: r.relSaturation,
  aboveFc: r.pctDaysAboveFieldCapacity,
  hlMoisture: r.stats.moistureHalfLifeDays,
  hlBucket: r.stats.bucketHalfLifeDays,
  dropPerDay: r.stats.moistureDropPerDay,
  rho: r.stats.bucketMoistureRho,
  rainGain: r.stats.rainGainPctPerMm,
}))

const correlations: Correlation[] = [
  correlate(flat, 'clay', 'hlMoisture'),
  correlate(flat, 'clay', 'dropPerDay'),
  correlate(flat, 'clay', 'relSat'),
  correlate(flat, 'clay', 'aboveFc'),
  correlate(flat, 'sand', 'hlMoisture'),
  correlate(flat, 'stones', 'hlMoisture'),
  correlate(flat, 'soc', 'hlMoisture'),
  correlate(flat, 'clay', 'rho'),
  correlate(flat, 'hlBucket', 'hlMoisture'),
]

const ratios = rows
  .map((r) => (r.stats.moistureHalfLifeDays && r.stats.bucketHalfLifeDays ? r.stats.moistureHalfLifeDays / r.stats.bucketHalfLifeDays : null))
  .filter((v): v is number => v !== null)
const wideClay = rows.filter((r) => r.soil && r.soil.clayQ95 !== null && r.soil.clayQ05 !== null && r.soil.clayQ95 - r.soil.clayQ05 > 40).length
const withSoil = rows.filter((r) => r.soil).length
const period = describePeriod(rows)
const earliest = rows.map((r) => r.period.from).sort()[0]!
const censored = rows.reduce((n, r) => n + r.stats.moistureSpellsCensored, 0)
const used = rows.reduce((n, r) => n + r.stats.moistureSpellsUsed, 0)

console.log(`\nSoil backtest — ${rows.length} spots, moisture layer ${layer}, evaluated ${period}\n`)
console.log(formatSpotTable(rows))
console.log('\nt½ = days for the water a storm added to fall by half; (a/b) = dry-downs that reached half / dry-downs measured.')
console.log('rel.sat = median moisture between wilting point (0) and field capacity (1), from SoilGrids. % > FC = share of days above field capacity.\n')
console.log(formatLadder(rows))
console.log(`\n${formatCorrelations(correlations, 'Does soil texture explain drying? (Spearman, across spots)')}`)
console.log('\nReading this:')
console.log(`  - ${describeSpeedRatio(ratios)}`)
console.log(`  - ${used} dry-downs reached half and ${censored} never did before the next rain — slow drying shows up as censored, not as missing.`)
console.log(`  - ${wideClay} of ${withSoil} spots have a SoilGrids clay range wider than 40 percentage points: the point estimate is a weak hint.`)
console.log('  - The weather model brings its own soil assumptions, so its moisture is only comparable between spots as a *change*, not as an absolute level.')
console.log(`  - Nothing before ${earliest} is covered: the forecast endpoint has no soil moisture earlier, so this cannot say how clay behaves in autumn and winter.`)
const failureText = formatFailures(failures)
if (failureText) console.log(`\n${failureText}`)

// Never overwrite: an explicit --out that already exists gets a numbered sibling.
const now = new Date()
const latest = rows.map((r) => r.period.to).sort().at(-1)!
const wanted = args.get('out') ?? join(resultsDir, resultFileName({ from: earliest, to: latest, layer, at: now }))
const outFile = nonClobberingPath(wanted, existsSync)
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(
  outFile,
  // The options are part of the result: two runs are only comparable if you know what produced them.
  JSON.stringify({ generatedAt: now.toISOString(), layer, options: analyse, rows, correlations, failures }, null, 2),
)
if (outFile !== wanted) console.log(`\n${wanted} already exists — wrote ${outFile} instead.`)
console.log(`\nFull results: ${outFile}`)
