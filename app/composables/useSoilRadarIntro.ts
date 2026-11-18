import { ref, computed, watch, onScopeDispose } from 'vue'

export const INTRO_SEEN_KEY = 'soil-radar-intro-seen'
export const INTRO_DWELL_MS = 4000

function readSeen(): boolean {
  try { return localStorage.getItem(INTRO_SEEN_KEY) === '1' } catch { return false }
}

/**
 * One-time callout + button pulse that introduces the Boden-Radar on /map.
 * `busy` holds the callout back while a sheet/modal covers the map; `used` (radar on) retires it for good.
 * `afterEngagement()` (experiment arm B, read at show time) swaps the dwell timer for the visit's `engaged`
 * event and keeps the button pulse off until then.
 */
export function useSoilRadarIntro(opts: {
  busy: () => boolean
  used: () => boolean
  afterEngagement?: () => boolean
  engaged?: () => boolean
}) {
  const unseen = ref(!readSeen())
  const gated = () => !!opts.afterEngagement?.()
  const highlight = computed(() => unseen.value && (!gated() || !!opts.engaged?.()))
  const started = ref(false)
  const show = ref(false)
  const due = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function markSeen() {
    show.value = false
    unseen.value = false
    due.value = false
    if (timer) clearTimeout(timer)
    timer = null
    try { localStorage.setItem(INTRO_SEEN_KEY, '1') } catch { /* shows again next visit, harmless */ }
  }

  watch(opts.used, (u) => { if (u && unseen.value) markSeen() }, { immediate: true })

  watch([due, opts.busy], ([d, b]) => {
    if (d && !b && unseen.value) show.value = true
  }, { flush: 'sync' })

  // Arm B: due once the map is up and the visit has engaged, never on a timer.
  watch(() => started.value && gated() && !!opts.engaged?.(), (ok) => { if (ok) due.value = true }, { flush: 'sync' })

  function start() {
    started.value = true
    if (!unseen.value || timer || gated()) return
    timer = setTimeout(() => {
      timer = null
      if (!gated()) due.value = true
    }, INTRO_DWELL_MS)
  }

  onScopeDispose(() => { if (timer) clearTimeout(timer) })

  return { show, highlight, start, dismiss: markSeen }
}
