import { ref, watch, onScopeDispose } from 'vue'

export const INTRO_SEEN_KEY = 'soil-radar-intro-seen'
export const INTRO_DWELL_MS = 4000

function readSeen(): boolean {
  try { return localStorage.getItem(INTRO_SEEN_KEY) === '1' } catch { return false }
}

/**
 * One-time callout + button pulse that introduces the Boden-Radar on /map.
 * `busy` holds the callout back while a sheet/modal covers the map; `used` (radar on) retires it for good.
 */
export function useSoilRadarIntro(opts: { busy: () => boolean; used: () => boolean }) {
  const highlight = ref(!readSeen())
  const show = ref(false)
  const due = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function markSeen() {
    show.value = false
    highlight.value = false
    due.value = false
    if (timer) clearTimeout(timer)
    timer = null
    try { localStorage.setItem(INTRO_SEEN_KEY, '1') } catch { /* shows again next visit, harmless */ }
  }

  watch(opts.used, (u) => { if (u && highlight.value) markSeen() }, { immediate: true })

  watch([due, opts.busy], ([d, b]) => {
    if (d && !b && highlight.value) show.value = true
  }, { flush: 'sync' })

  function start() {
    if (!highlight.value || timer) return
    timer = setTimeout(() => {
      timer = null
      due.value = true
    }, INTRO_DWELL_MS)
  }

  onScopeDispose(() => { if (timer) clearTimeout(timer) })

  return { show, highlight, start, dismiss: markSeen }
}
