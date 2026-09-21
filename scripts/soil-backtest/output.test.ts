import { describe, it, expect } from 'vitest'
import { resultFileName, nonClobberingPath } from './output'

describe('resultFileName', () => {
  const at = new Date('2026-10-21T07:05:09Z')

  it('names a result after the period it covers, the layer, and when it was made', () => {
    expect(resultFileName({ from: '2026-07-19', to: '2026-09-19', layer: 'soil_moisture_3_to_9cm', at })).toBe(
      'results_2026-07-19_2026-09-19_soil_moisture_3_to_9cm_20261021-070509.json',
    )
  })

  it('gives two runs of the same period different names, so a rerun never overwrites the first', () => {
    const args = { from: '2026-07-19', to: '2026-09-19', layer: 'soil_moisture_3_to_9cm' }

    const first = resultFileName({ ...args, at: new Date('2026-10-21T07:05:09Z') })
    const second = resultFileName({ ...args, at: new Date('2026-10-21T07:05:10Z') })

    expect(first).not.toBe(second)
  })

  it('sorts chronologically by name, so a directory listing reads as a history', () => {
    const args = { layer: 'l' }
    const earlier = resultFileName({ ...args, from: '2026-07-19', to: '2026-09-19', at: new Date('2026-09-21T10:00:00Z') })
    const later = resultFileName({ ...args, from: '2026-08-20', to: '2026-10-20', at: new Date('2026-10-21T10:00:00Z') })

    expect([later, earlier].sort()).toEqual([earlier, later])
  })

  it('uses UTC, so the same instant gets the same name on every machine', () => {
    const name = resultFileName({ from: 'a', to: 'b', layer: 'l', at: new Date('2026-01-01T23:59:59Z') })

    expect(name).toContain('20260101-235959')
  })
})

describe('nonClobberingPath', () => {
  it('returns the path unchanged when nothing is there', () => {
    expect(nonClobberingPath('/r/results.json', () => false)).toBe('/r/results.json')
  })

  it('numbers the file instead of overwriting an existing one', () => {
    const taken = new Set(['/r/results.json'])

    expect(nonClobberingPath('/r/results.json', (p) => taken.has(p))).toBe('/r/results-2.json')
  })

  it('keeps counting past numbered files that already exist', () => {
    const taken = new Set(['/r/results.json', '/r/results-2.json', '/r/results-3.json'])

    expect(nonClobberingPath('/r/results.json', (p) => taken.has(p))).toBe('/r/results-4.json')
  })

  it('keeps the directory and the extension intact', () => {
    const taken = new Set(['/a/b.c/run.final.json'])

    expect(nonClobberingPath('/a/b.c/run.final.json', (p) => taken.has(p))).toBe('/a/b.c/run.final-2.json')
  })

  it('handles a file without an extension', () => {
    const taken = new Set(['/r/out'])

    expect(nonClobberingPath('/r/out', (p) => taken.has(p))).toBe('/r/out-2')
  })
})
