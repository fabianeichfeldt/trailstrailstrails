// Registry for page-scoped Android/gesture back-button handling. The actual
// native listener is registered once, globally, in plugins/capacitor.client.ts
// (it must survive route changes to handle back on every screen, including
// the root page which mounts no map composable at all). Pages that want a
// crack at the back press first — e.g. useTrailMap.ts dismissing the spot
// panel before falling through to router history — register a handler here
// instead of adding their own native listener.
type BackHandler = () => boolean

const handlers: BackHandler[] = []

export function registerBackHandler(handler: BackHandler): () => void {
  handlers.push(handler)
  return () => {
    const i = handlers.indexOf(handler)
    if (i !== -1) handlers.splice(i, 1)
  }
}

// Runs the most-recently-registered handler first; returns true if one of
// them consumed the press (nothing further — e.g. router history — should run).
export function runBackHandlers(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i]()) return true
  }
  return false
}
