export const HEARTBEAT_MS = 30_000
export const HEARTBEAT_CAP = 240
const INTERACTIONS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

/** `active` ping every 30 s while the tab is visible and the user interacted within that window. Returns a stopper. */
export function startHeartbeat(send: () => void, doc: Document = document, now: () => number = Date.now, cap = HEARTBEAT_CAP) {
  let lastInteraction = -Infinity
  let sent = 0
  const mark = () => { lastInteraction = now() }
  const opts = { passive: true, capture: true } as const
  for (const e of INTERACTIONS) doc.addEventListener(e, mark, opts)
  const timer = setInterval(() => {
    if (doc.visibilityState !== 'visible' || now() - lastInteraction > HEARTBEAT_MS) return
    send()
    if (++sent >= cap) stop()
  }, HEARTBEAT_MS)
  function stop() {
    clearInterval(timer)
    for (const e of INTERACTIONS) doc.removeEventListener(e, mark, opts)
  }
  return stop
}
