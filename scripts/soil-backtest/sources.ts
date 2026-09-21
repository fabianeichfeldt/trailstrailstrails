/**
 * The two data sources of the soil backtest, behind an injectable fetch so the
 * tests never touch the network:
 *
 *  - SoilGrids (ISRIC): soil texture, stones, organic carbon and water
 *    retention at a point. Free, no key, CC BY 4.0 — but a *beta* service,
 *    slow (~3 s a call), and it timed out on a single 8-property request while
 *    answering three smaller ones in ~3 s each. So: small groups, retries,
 *    and a pause between calls.
 *  - Open-Meteo: 92 days of hourly rain and soil moisture, already available
 *    in one call — no need to collect history over weeks.
 */

export interface FetchDeps {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  sleep: (ms: number) => Promise<void>
}

// ── HTTP with retry ────────────────────────────────────────────────────────

class ClientError extends Error {}

export interface RetryOptions {
  retries?: number
  baseDelayMs?: number
  timeoutMs?: number
}

/**
 * GET → JSON. Retries network errors, 429 and 5xx with doubling backoff; a
 * 4xx other than 429 fails at once because retrying will not make a bad
 * request good. The message always carries the last status so a failed run
 * says why.
 */
export async function fetchJsonWithRetry(url: string, deps: FetchDeps, opts: RetryOptions = {}): Promise<unknown> {
  const { retries = 3, baseDelayMs = 2000, timeoutMs = 60_000 } = opts
  let last = 'no attempt made'
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await deps.sleep(baseDelayMs * 2 ** (attempt - 1))
    try {
      const signal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined
      const res = await deps.fetch(url, signal ? { signal } : undefined)
      if (res.ok) return await res.json()
      if (res.status !== 429 && res.status < 500) throw new ClientError(`HTTP ${res.status} for ${url}`)
      last = `HTTP ${res.status}`
    } catch (error) {
      if (error instanceof ClientError) throw error
      last = error instanceof Error ? error.message : String(error)
    }
  }
  throw new Error(`${url} failed after ${retries + 1} attempts (last: ${last})`)
}

// ── SoilGrids ──────────────────────────────────────────────────────────────

const SOILGRIDS = 'https://rest.isric.org/soilgrids/v2.0/properties/query'

/**
 * The depth used for everything: 5-15 cm is where a tyre and a boot actually
 * work the ground — the top 5 cm is litter and humus in forest.
 */
export const SOIL_DEPTH = '5-15cm'

/** Requested in small groups: all eight in one call timed out at 90 s. */
export const SOIL_PROPERTY_GROUPS: string[][] = [
  ['clay', 'sand', 'silt'],
  ['cfvo', 'soc'],
  ['wv0010', 'wv0033', 'wv1500'],
]

export function buildSoilGridsUrl(lat: number, lon: number, properties: string[], withUncertainty: boolean): string {
  const params = new URLSearchParams()
  params.append('lon', String(lon))
  params.append('lat', String(lat))
  for (const p of properties) params.append('property', p)
  params.append('depth', SOIL_DEPTH)
  params.append('value', 'mean')
  if (withUncertainty) {
    params.append('value', 'Q0.05')
    params.append('value', 'Q0.95')
  }
  return `${SOILGRIDS}?${params.toString()}`
}

export interface SoilLayer {
  mean: number
  /** 5% / 95% bounds — null when they were not requested. */
  q05: number | null
  q95: number | null
}

interface RawLayer {
  name?: string
  unit_measure?: { d_factor?: number }
  depths?: { label?: string; values?: Record<string, number | null> }[]
}

/**
 * SoilGrids returns integers scaled by a per-property `d_factor` (clay 244 with
 * d_factor 10 is 24.4 %). This undoes that, so nothing downstream sees the
 * integer encoding.
 */
export function parseSoilGridsLayers(json: unknown): Map<string, SoilLayer> {
  const layers = (json as { properties?: { layers?: RawLayer[] } } | null)?.properties?.layers
  if (!Array.isArray(layers)) {
    throw new Error(`Not a SoilGrids response: ${JSON.stringify(json).slice(0, 200)}`)
  }
  const out = new Map<string, SoilLayer>()
  for (const layer of layers) {
    if (!layer.name) continue
    const depth = layer.depths?.find((d) => d.label === SOIL_DEPTH) ?? layer.depths?.[0]
    const factor = layer.unit_measure?.d_factor || 1
    const values = depth?.values
    if (!values || typeof values.mean !== 'number') continue // no data at this point (water, ice)
    const bound = (key: string) => (typeof values[key] === 'number' ? (values[key] as number) / factor : null)
    out.set(layer.name, { mean: values.mean / factor, q05: bound('Q0.05'), q95: bound('Q0.95') })
  }
  return out
}

export interface SoilProfile {
  /** Fine-earth fractions, %. */
  clay: number
  sand: number
  silt: number
  /** 5% / 95% bounds on clay — the point estimate is often far less certain than it looks. */
  clayQ05: number | null
  clayQ95: number | null
  /** Coarse fragments (stones), vol-%. */
  cfvo: number
  /** Soil organic carbon, g/kg. */
  soc: number
  /** Volumetric water content at 10 kPa (about saturation), 33 kPa (field capacity), 1500 kPa (wilting point), m³/m³. */
  wv0010: number
  wv0033: number
  wv1500: number
  /** How far from the spot the reading was taken, in metres (0 or absent = exactly at the spot). */
  offsetMetres?: number
}

const REQUIRED = ['clay', 'sand', 'silt', 'cfvo', 'soc', 'wv0010', 'wv0033', 'wv1500']

export function assembleSoilProfile(layers: Map<string, SoilLayer>): SoilProfile {
  const missing = REQUIRED.filter((name) => !layers.has(name))
  if (missing.length > 0) throw new Error(`SoilGrids response is missing: ${missing.join(', ')}`)
  const mean = (name: string) => layers.get(name)!.mean
  return {
    clay: mean('clay'),
    sand: mean('sand'),
    silt: mean('silt'),
    clayQ05: layers.get('clay')!.q05,
    clayQ95: layers.get('clay')!.q95,
    cfvo: mean('cfvo'),
    soc: mean('soc'),
    // SoilGrids reports water content in vol-%; the weather model uses m³/m³.
    wv0010: mean('wv0010') / 100,
    wv0033: mean('wv0033') / 100,
    wv1500: mean('wv1500') / 100,
  }
}

/**
 * SoilGrids answered, but has no value at this point. Real case: the town
 * centre of Kulmbach — every property comes back `mean: null` (built-up land is
 * masked out of the map). Distinct from a failed request, because the remedy is
 * a neighbouring point, not a retry.
 */
export class NoSoilDataError extends Error {}

export async function fetchSoilProfile(
  lat: number,
  lon: number,
  deps: FetchDeps,
  opts: { pauseMs?: number } & RetryOptions = {},
): Promise<SoilProfile> {
  const { pauseMs = 1000, ...retry } = opts
  const layers = new Map<string, SoilLayer>()
  for (const [i, group] of SOIL_PROPERTY_GROUPS.entries()) {
    if (i > 0 && pauseMs > 0) await deps.sleep(pauseMs)
    const json = await fetchJsonWithRetry(buildSoilGridsUrl(lat, lon, group, group.includes('clay')), deps, retry)
    for (const [name, layer] of parseSoilGridsLayers(json)) layers.set(name, layer)
    // The texture group comes first: if the pixel is masked there is no point
    // spending two more slow calls on it.
    if (i === 0 && !layers.has('clay')) throw new NoSoilDataError(`SoilGrids has no soil data at ${lat}, ${lon}`)
  }
  return assembleSoilProfile(layers)
}

/** Rings searched around a masked point, in metres — roughly one and two SoilGrids pixels. */
const SEARCH_RINGS_M = [300, 600]

function offsetPoint(lat: number, lon: number, metres: number, bearingDeg: number): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180
  const dLat = (metres * Math.cos(rad)) / 111_320
  const dLon = (metres * Math.sin(rad)) / (111_320 * Math.cos((lat * Math.PI) / 180))
  return [Number((lat + dLat).toFixed(6)), Number((lon + dLon).toFixed(6))]
}

/**
 * The soil at the spot — or, if that pixel is masked, at the nearest of eight
 * points around it at 300 m and then 600 m. The distance is kept on the
 * profile, so a reading taken 300 m away is never passed off as the spot's own.
 */
export async function fetchSoilProfileNear(
  lat: number,
  lon: number,
  deps: FetchDeps,
  opts: { pauseMs?: number } & RetryOptions = {},
): Promise<SoilProfile> {
  const candidates: { point: [number, number]; metres: number }[] = [{ point: [lat, lon], metres: 0 }]
  for (const metres of SEARCH_RINGS_M) {
    for (let bearing = 0; bearing < 360; bearing += 45) candidates.push({ point: offsetPoint(lat, lon, metres, bearing), metres })
  }

  for (const [i, { point, metres }] of candidates.entries()) {
    if (i > 0 && (opts.pauseMs ?? 1000) > 0) await deps.sleep(opts.pauseMs ?? 1000)
    try {
      return { ...(await fetchSoilProfile(point[0], point[1], deps, opts)), offsetMetres: metres }
    } catch (error) {
      if (!(error instanceof NoSoilDataError)) throw error
    }
  }
  throw new NoSoilDataError(`No soil data within ${SEARCH_RINGS_M.at(-1)} m of ${lat}, ${lon}`)
}

// ── Open-Meteo history ─────────────────────────────────────────────────────

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'

/** How far back the forecast endpoint reaches (past_days). */
export const HISTORY_DAYS = 92

export const MOISTURE_LAYERS = ['soil_moisture_1_to_3cm', 'soil_moisture_3_to_9cm', 'soil_moisture_9_to_27cm'] as const

/**
 * Same daily/current fields the app requests (communication/weather.ts), so the
 * payload feeds the real trail-condition model unchanged — plus the moisture
 * layers on the hourly grid.
 */
export function buildHistoryUrl(lat: number, lon: number, pastDays = HISTORY_DAYS): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    past_days: String(pastDays),
    forecast_days: '1',
    timezone: 'auto',
    current: 'temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m',
    daily:
      'weather_code,precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration,snowfall_sum',
    hourly: ['precipitation', 'snowfall', ...MOISTURE_LAYERS].join(','),
  })
  return `${OPEN_METEO}?${params.toString()}`
}

export async function fetchHistory(lat: number, lon: number, deps: FetchDeps, opts: RetryOptions = {}): Promise<unknown> {
  return fetchJsonWithRetry(buildHistoryUrl(lat, lon), deps, opts)
}
