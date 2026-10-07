import type { Ref } from 'vue'
import { clearSoilCache, fetchSoilMap } from '~/communication/soilMap'
import type { FeatureAccess } from '~/entitlements/features'
import { SOIL_AXIS_MAX, type SoilMapResponse, type SoilMapSpot } from '~/types/SoilMap'
import type { ConditionLevel } from '~/types/Weather'

const ENABLED_KEY = 'soil-radar-enabled'
const RANGE_KEY = 'soil-radar-range'
const STALE_AFTER_MS = 24 * 60 * 60 * 1000
const FULL_RANGE = { lo: 0, hi: SOIL_AXIS_MAX }

// Storage can throw (private mode, blocked data) — a missing preference must never break the map.
function readEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === '1' } catch { return false }
}

function writeEnabled(on: boolean): void {
  try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0') } catch { /* preference just won't persist */ }
}

function clamp(n: number): number {
  return Math.min(SOIL_AXIS_MAX, Math.max(0, n))
}

function readRange(): { lo: number; hi: number } {
  try {
    const raw = localStorage.getItem(RANGE_KEY)
    if (!raw) return { ...FULL_RANGE }
    const r = JSON.parse(raw) as { lo?: unknown; hi?: unknown }
    if (typeof r?.lo !== 'number' || typeof r?.hi !== 'number') return { ...FULL_RANGE }
    return { lo: clamp(Math.min(r.lo, r.hi)), hi: clamp(Math.max(r.lo, r.hi)) }
  } catch {
    return { ...FULL_RANGE }
  }
}

// Fixed seed so the demo looks the same every time; a west-dry/east-wet "front" makes it plausible.
const SAMPLE_LEVELS: ConditionLevel[] = ['dusty', 'dry', 'prime', 'damp', 'wet']
const SAMPLE_COUNT = 25

function sampleScene(center: { lat: number; lon: number }): SoilMapSpot[] {
  let seed = 20261007
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
  }
  const types: SoilMapSpot['t'][] = ['trail', 'trail', 'trail', 'bikepark', 'dirtpark']
  const spots: SoilMapSpot[] = []
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const dx = (rnd() - 0.5) * 1.2 // degrees lon, ±0.6
    const dy = (rnd() - 0.5) * 0.8 // degrees lat, ±0.4
    // The front runs north-south: position along it picks the level, a little noise blurs the edge.
    const pos = (dx + 0.6) / 1.2 + (rnd() - 0.5) * 0.25
    const axis = Math.min(SOIL_AXIS_MAX, Math.max(0, Math.round(pos * SOIL_AXIS_MAX)))
    let lvl: ConditionLevel = SAMPLE_LEVELS[axis]!
    if (i === 3) lvl = 'raining'
    if (i === 11) lvl = 'snow'
    const lo = Math.max(0, axis - 1)
    const hi = Math.min(SOIL_AXIS_MAX, axis + 1)
    spots.push({
      t: types[i % types.length]!, id: `sample-${i}`,
      lat: center.lat + dy, lon: center.lon + dx,
      lvl, lo: i % 7 === 6 ? null : lo, hi: i % 7 === 6 ? null : hi,
    })
  }
  return spots
}

function settled(access: Ref<FeatureAccess>): Promise<Exclude<FeatureAccess, 'checking'>> {
  return new Promise((resolve) => {
    const stop = watch(access, (a) => {
      if (a === 'checking') return
      queueMicrotask(() => stop())
      resolve(a)
    }, { immediate: true })
  })
}

export const useSoilRadarStore = defineStore('soilRadar', () => {
  const auth = useAuthStore()
  const enabled = ref(readEnabled())
  const mode = ref<'live' | 'sample'>('live')
  const data = ref<SoilMapResponse | null>(null)
  const range = ref(readRange())
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const offline = ref(false)
  // Set when soil-map answers 403: the browser's entitlement is stale; the UI shows the locked sheet.
  const forbidden = ref(false)
  const sample = ref<SoilMapSpot[]>([])

  const points = computed<SoilMapSpot[]>(() => mode.value === 'sample' ? sample.value : data.value?.spots ?? [])

  const index = computed(() => {
    const m = new Map<string, ConditionLevel>()
    for (const s of data.value?.spots ?? []) m.set(`${s.t}:${s.id}`, s.lvl)
    return m
  })

  const freshness = computed(() => {
    if (mode.value === 'sample' || !data.value) return null
    const at = Date.parse(data.value.computedAt)
    return {
      computedAt: data.value.computedAt,
      stale: Date.now() - at > STALE_AFTER_MS,
      offline: offline.value,
    }
  })

  function verdictFor(type: string, id: string): ConditionLevel | undefined {
    return mode.value === 'live' ? index.value.get(`${type}:${id}`) : undefined
  }

  /** Fetches (or reads the cache for) the live snapshot; returns whether data is available. */
  async function fetchLive(): Promise<boolean> {
    status.value = 'loading'
    forbidden.value = false
    const userId = await auth.getUserId()
    const token = await auth.getToken()
    const res = await fetchSoilMap(token, userId, () => { forbidden.value = true })
    // Signed out or switched account mid-request: the answer belongs to the previous user.
    if (userId !== auth.userId) return false
    if (!res) {
      status.value = 'error'
      return false
    }
    data.value = res.data
    offline.value = res.offline
    status.value = 'ready'
    return true
  }

  async function toggle(): Promise<void> {
    if (status.value === 'loading') return
    if (mode.value === 'sample') return stopSample()
    if (enabled.value) {
      enabled.value = false
      writeEnabled(false)
      return
    }
    if (await fetchLive()) {
      enabled.value = true
      writeEnabled(true)
    }
  }

  /** For a restored `enabled`: waits for the entitlement, then loads or silently switches off. */
  async function restore(access: Ref<FeatureAccess>): Promise<void> {
    // Read storage, not the refs: prerender has no localStorage, so the hydrated payload holds defaults.
    range.value = readRange()
    if (mode.value !== 'live' || !readEnabled()) return
    if (await settled(access) === 'locked') {
      enabled.value = false
      writeEnabled(false)
      return
    }
    enabled.value = true
    return load()
  }

  async function load(): Promise<void> {
    if (mode.value !== 'live' || !enabled.value || status.value === 'loading') return
    if (await fetchLive()) return
    enabled.value = false
    if (forbidden.value) writeEnabled(false)
  }

  // Paid data and the "on" preference belong to whoever was signed in; '' → user is just auth resolving.
  watch(() => auth.userId, (now, before) => {
    if (!before || now === before || mode.value !== 'live') return
    enabled.value = false
    writeEnabled(false)
    data.value = null
    offline.value = false
    forbidden.value = false
    status.value = 'idle'
    clearSoilCache()
  })

  function setRange(lo: number, hi: number): void {
    const a = clamp(Math.min(lo, hi))
    const b = clamp(Math.max(lo, hi))
    range.value = { lo: a, hi: b }
    // Written here, not in a watch(): hydration's reset to the default would trigger it and overwrite storage.
    try { localStorage.setItem(RANGE_KEY, JSON.stringify(range.value)) } catch { /* preference just won't persist */ }
  }

  function startSample(center: { lat: number; lon: number }): void {
    sample.value = sampleScene(center)
    mode.value = 'sample'
    enabled.value = true
  }

  function stopSample(): void {
    sample.value = []
    mode.value = 'live'
    enabled.value = false
  }

  return {
    enabled, mode, data, range, status, offline, forbidden,
    points, freshness, verdictFor, toggle, restore, setRange, startSample, stopSample,
  }
})
