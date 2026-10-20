import { computed, ref, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import type { FeatureAccess, FeatureKey } from './features'

/**
 * One paid feature's fetch, as a state machine: entitlement → token fetch →
 * user-scoped cache. Each feature plugs in only an adapter (endpoint + freshness
 * rule); the gate, 403 handling, cache ownership and stale guard live here once.
 *
 * The real gate is the feature's edge function (JWT + has_min_tier). This module
 * only decides what to render and whether to ask at all.
 */

export type GatedState = 'checking' | 'locked' | 'idle' | 'loading' | 'ready' | 'error'

/** What one request to a gated edge function came back with. Never a thrown error. */
export type GatedResponse<T> = { kind: 'ok'; data: T } | { kind: 'forbidden' } | { kind: 'failed' }

export interface GatedEntry<T> {
  /** Owner — paid data must not outlive a logout on a shared browser. */
  uid: string
  /** Fetch time (ms). */
  at: number
  data: T
}

export interface GatedAdapter<P, T> {
  feature: FeatureKey
  /** Every cache key of this feature starts with it, so a logout can sweep them all. */
  cachePrefix: string
  cacheKey(params: P): string
  request(token: string, params: P): Promise<GatedResponse<T>>
  isValid(value: unknown): value is T
  isFresh(entry: GatedEntry<T>, now: number): boolean
  /** Serve an expired entry, flagged offline, when the network fails. */
  offlineFallback: boolean
}

export interface GatedDeps {
  /** The browser's view of the entitlement (subscription.accessFor) — not SSR-safe by itself. */
  access: () => FeatureAccess
  /** Reactive current user id; '' when signed out. */
  userId: () => string
  getUserId: () => Promise<string>
  getToken: () => Promise<string>
}

/** How a `load()` ended; 'superseded' = a newer load or a user change took over. */
export type LoadOutcome = 'ready' | 'locked' | 'error' | 'superseded'

export interface GatedFetch<P, T> {
  state: ComputedRef<GatedState>
  data: Ref<T | null>
  /** True when `data` is an expired entry served because the network failed. */
  offline: Ref<boolean>
  /** Call from onMounted: until then `state` says 'checking' (the SSG HTML must not bake in one visitor). */
  markMounted(): void
  load(params: P): Promise<LoadOutcome>
  reset(): void
}

// Storage is missing during prerender and throws in some private modes — a missing cache never breaks a page.
function storage(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

function removeKey(key: string): void {
  try { storage()?.removeItem(key) } catch { /* nothing sensible left to do */ }
}

/** Removes every cache entry under these prefixes (see plugins/paidCacheSweep.client.ts). */
export function sweepCaches(prefixes: readonly string[]): void {
  const s = storage()
  if (!s) return
  try {
    const keys: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (k && prefixes.some(p => k.startsWith(p))) keys.push(k)
    }
    keys.forEach(removeKey)
  } catch { /* nothing sensible left to do */ }
}

export function createGatedFetch<P, T>(adapter: GatedAdapter<P, T>, deps: GatedDeps): GatedFetch<P, T> {
  const mounted = ref(false)
  const phase = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  // A 403: the browser thought the user was entitled, the server disagrees.
  const forbidden = ref(false)
  const data = shallowRef<T | null>(null) as Ref<T | null>
  const offline = ref(false)
  let seq = 0
  let currentKey: string | null = null

  const state = computed<GatedState>(() => {
    if (!mounted.value) return 'checking'
    const access = deps.access()
    if (access !== 'allowed' || forbidden.value) return access === 'checking' ? 'checking' : 'locked'
    return phase.value
  })

  function readEntry(key: string, uid: string): GatedEntry<T> | null {
    const s = storage()
    if (!uid || !s) return null
    try {
      const raw = s.getItem(key)
      if (!raw) return null
      const entry = JSON.parse(raw) as GatedEntry<T>
      if (typeof entry?.at !== 'number' || !adapter.isValid(entry.data)) throw new Error('corrupt cache entry')
      if (entry.uid !== uid) throw new Error('someone else\'s cache entry')
      return entry
    } catch {
      removeKey(key)
      return null
    }
  }

  function writeEntry(key: string, uid: string, value: T): void {
    if (!uid) return
    try {
      storage()?.setItem(key, JSON.stringify({ uid, at: Date.now(), data: value } satisfies GatedEntry<T>))
    } catch { /* quota or private mode — the fetch still succeeded */ }
  }

  function reset(): void {
    seq++
    currentKey = null
    phase.value = 'idle'
    data.value = null
    offline.value = false
    forbidden.value = false
  }

  async function load(params: P): Promise<LoadOutcome> {
    if (state.value === 'checking' || state.value === 'locked') return state.value === 'locked' ? 'locked' : 'superseded'
    const mySeq = ++seq
    const key = adapter.cacheKey(params)
    // Another spot's answer must not stay on screen while this one loads.
    if (key !== currentKey) {
      data.value = null
      offline.value = false
    }
    currentKey = key
    phase.value = 'loading'
    let uid = ''
    let cached: GatedEntry<T> | null = null
    const superseded = () => mySeq !== seq || uid !== deps.userId()
    const settle = (value: T, isOffline: boolean): LoadOutcome => {
      data.value = value
      offline.value = isOffline
      phase.value = 'ready'
      return 'ready'
    }
    try {
      uid = await deps.getUserId()
      if (superseded()) return 'superseded'
      cached = readEntry(key, uid)
      if (cached && adapter.isFresh(cached, Date.now())) return settle(cached.data, false)

      const res = await adapter.request(await deps.getToken(), params)
      if (superseded()) return 'superseded'
      if (res.kind === 'forbidden') {
        // A downgraded user keeps nothing they no longer pay for.
        sweepCaches([adapter.cachePrefix])
        data.value = null
        offline.value = false
        phase.value = 'idle'
        forbidden.value = true
        return 'locked'
      }
      if (res.kind === 'ok') {
        writeEntry(key, uid, res.data)
        return settle(res.data, false)
      }
    } catch {
      // uid may never have resolved here, so only a newer load counts as superseding.
      if (mySeq !== seq) return 'superseded'
    }
    if (adapter.offlineFallback && cached) return settle(cached.data, true)
    phase.value = 'error'
    return 'error'
  }

  // Paid data belongs to whoever was signed in; '' → user is just auth resolving on page load.
  // Storage is swept app-wide by plugins/paidCacheSweep.client.ts, gate or no gate.
  watch(deps.userId, (now, before) => {
    if (before && now !== before) reset()
  }, { flush: 'sync' })

  // A fresh entitlement (e.g. an upgrade) gets to ask again after an earlier 403.
  watch(deps.access, () => { forbidden.value = false })

  return { state, data, offline, markMounted: () => { mounted.value = true }, load, reset }
}

/** Resolves once `state` has left 'checking'. */
export function settled(state: Ref<GatedState>): Promise<Exclude<GatedState, 'checking'>> {
  return new Promise((resolve) => {
    const stop = watch(state, (s) => {
      if (s === 'checking') return
      queueMicrotask(() => stop())
      resolve(s)
    }, { immediate: true })
  })
}
