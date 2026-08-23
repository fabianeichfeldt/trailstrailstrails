import { describe, it, expect } from 'vitest'
import { GpxRenderGuard } from './gpxRenderGuard'

describe('GpxRenderGuard', () => {
  it('is not stale when gen matches and mode is gpx', () => {
    const guard = new GpxRenderGuard()
    guard.enterGpxMode()
    const gen = guard.beginRender()
    expect(guard.isStale(gen)).toBe(false)
  })

  it('is stale when a newer render started', () => {
    const guard = new GpxRenderGuard()
    guard.enterGpxMode()
    const gen = guard.beginRender()
    guard.beginRender()  // newer render supersedes
    expect(guard.isStale(gen)).toBe(true)
  })

  it('is stale when mode switched back to markers (the race condition)', () => {
    const guard = new GpxRenderGuard()
    guard.enterGpxMode()
    const gen = guard.beginRender()
    guard.enterMarkerMode()  // user zoomed back out while fetch was in flight
    expect(guard.isStale(gen)).toBe(true)
  })
})

// ── Async race simulation ────────────────────────────────────────────────────
// Reproduces the exact scenario that caused markers to vanish:
// 1. renderGpxView starts (removes markers sync, awaits fetch)
// 2. user zooms out — renderMarkers restores markers
// 3. fetch resolves — stale render must NOT add gpx layers

describe('renderGpxView / switchView race', () => {
  async function simulate(withFix: boolean) {
    let viewMode: 'markers' | 'gpx' = 'gpx'
    let renderGen = 0
    let gpxLayersAdded = 0
    let markersVisible = false

    let resolveFetch!: () => void
    const fetchDone = new Promise<void>(r => { resolveFetch = r })

    async function renderGpxView() {
      const gen = ++renderGen
      markersVisible = false  // sync: marker layers removed from map

      await fetchDone

      const stale = withFix
        ? gen !== renderGen || viewMode !== 'gpx'
        : gen !== renderGen  // original (buggy) guard

      if (stale) return
      gpxLayersAdded++  // would add fallback layer + gpx polylines
    }

    function switchToMarkers() {
      viewMode = 'markers'
      gpxLayersAdded = 0   // gpxLayers cleared
      markersVisible = true // renderMarkers() called
    }

    const p = renderGpxView()  // fetch in flight, markers already removed

    // user zooms out before fetch resolves
    switchToMarkers()

    resolveFetch()   // fetch completes — stale render wakes up
    await p

    return { gpxLayersAdded, markersVisible }
  }

  it('WITHOUT fix: stale render adds gpx layers after mode switch (demonstrates the bug)', async () => {
    const { gpxLayersAdded, markersVisible } = await simulate(false)
    expect(gpxLayersAdded).toBe(1)   // stale render ran — bad state
    expect(markersVisible).toBe(true) // markers are still there (restored by switchToMarkers)
    // → gpxLayers is polluted; next zoom-in clears stale entries AND marker layers,
    //   then if the user zooms back out before the new fetch resolves, markers
    //   disappear until renderMarkers() runs again — the visible flicker/loss
  })

  it('WITH fix: stale render aborts, no layers added, markers stay visible', async () => {
    const { gpxLayersAdded, markersVisible } = await simulate(true)
    expect(gpxLayersAdded).toBe(0)   // stale render aborted ✓
    expect(markersVisible).toBe(true) // markers visible ✓
  })
})
