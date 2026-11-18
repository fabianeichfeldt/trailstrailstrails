import { describe, it, expect } from 'vitest'
import { GpxRenderGuard } from './gpxRenderGuard'
import { renderGpxSwap } from './gpxSwap'

function setup() {
  const guard = new GpxRenderGuard()
  guard.enterGpxMode()
  const gen = guard.beginRender()
  const log: string[] = []
  let release!: () => void
  const pending = new Promise<void>(r => { release = r })
  const fetchData = async () => { log.push('fetch-start'); await pending; log.push('fetch-end') }
  const swap = () => { log.push('remove-markers'); log.push('add-gpx') }
  return { guard, gen, log, release, fetchData, swap }
}

describe('renderGpxSwap', () => {
  it('keeps markers on the map while the fetch is pending, then swaps after it resolves', async () => {
    const { guard, gen, log, release, fetchData, swap } = setup()
    const p = renderGpxSwap(guard, gen, fetchData, swap)
    await Promise.resolve()
    expect(log).toEqual(['fetch-start'])
    release()
    expect(await p).toBe(true)
    expect(log).toEqual(['fetch-start', 'fetch-end', 'remove-markers', 'add-gpx'])
  })

  it('does not touch the map when superseded during the fetch', async () => {
    const { guard, gen, log, release, fetchData, swap } = setup()
    const p = renderGpxSwap(guard, gen, fetchData, swap)
    guard.beginRender()
    release()
    expect(await p).toBe(false)
    expect(log).not.toContain('remove-markers')
  })

  it('does not touch the map when switched back to markers during the fetch', async () => {
    const { guard, gen, log, release, fetchData, swap } = setup()
    const p = renderGpxSwap(guard, gen, fetchData, swap)
    guard.enterMarkerMode()
    release()
    expect(await p).toBe(false)
    expect(log).toEqual(['fetch-start', 'fetch-end'])
  })
})
