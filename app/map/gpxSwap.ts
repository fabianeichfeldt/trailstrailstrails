import type { GpxRenderGuard } from './gpxRenderGuard'

/** Fetch first, then swap layers in one sync block; a stale render never touches the map. */
export async function renderGpxSwap(
  guard: GpxRenderGuard,
  gen: number,
  fetchData: () => Promise<void>,
  swap: () => void,
): Promise<boolean> {
  await fetchData()
  if (guard.isStale(gen)) return false
  swap()
  return true
}
