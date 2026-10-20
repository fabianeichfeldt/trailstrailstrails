import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createImportQueue, type PendingImport } from './importQueue'
import { DIFF_COLOR } from './GpxProcessor'
import type { GpxTrailRow } from './Api'
import type { MapViewLike } from './MapView'

const gpx = (name: string) => `<?xml version="1.0"?>
<gpx><trk><name>${name}</name><trkseg>
  <trkpt lat="48.000000" lon="11.500000"><ele>500</ele></trkpt>
  <trkpt lat="48.004000" lon="11.502000"><ele>540</ele></trkpt>
  <trkpt lat="48.008000" lon="11.504000"><ele>600</ele></trkpt>
  <trkpt lat="48.008000" lon="11.512000"><ele>550</ele></trkpt>
  <trkpt lat="48.008000" lon="11.519000"><ele>500</ele></trkpt>
</trkseg></trk></gpx>`

// Network boundary: DEM edge function, storage upload, PostgREST insert.
let uploads: string[]
let inserts: Array<Record<string, unknown>>
let failUploadFor: string | null

beforeEach(() => {
  uploads = []
  inserts = []
  failUploadFor = null
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input)
    const res = (body: unknown, ok = true) =>
      ({ ok, status: ok ? 200 : 500, json: async () => body, text: async () => JSON.stringify(body) })
    if (url.includes('/functions/v1/dem-elevation')) {
      const { points } = JSON.parse(String(init!.body))
      return res({ elevations: points.map(() => 700) })
    }
    if (url.includes('/storage/v1/object/gpx-files/')) {
      if (failUploadFor && url.includes(failUploadFor)) return res('boom', false)
      uploads.push(url.split('/gpx-files/')[1]!)
      return res({})
    }
    if (url.includes('/rest/v1/spot_gpx_trails')) {
      const row = JSON.parse(String(init!.body))
      inserts.push(row)
      return res([{ ...row, id: `new-${inserts.length}` }])
    }
    throw new Error(`unexpected fetch ${url}`)
  }))
})

function fakeMap() {
  const layers = new Map<string, string>()
  const map = {
    addPendingPolyline: vi.fn((key: string, _p: unknown, color: string) => { layers.set(key, color) }),
    updatePendingColor: vi.fn((key: string, color: string) => { layers.set(key, color) }),
    removeLayer: vi.fn((key: string) => { layers.delete(key) }),
    addTrailPolyline: vi.fn((t: GpxTrailRow) => { layers.set(t.id, 'trail') }),
    fitAll: vi.fn(),
  }
  return { map: map as unknown as MapViewLike, layers, fitAll: map.fitAll }
}

function setup() {
  const pending = { value: [] as PendingImport[] }
  const trails = { value: [{ id: 'old', name: 'Bestand' }] as GpxTrailRow[] }
  const m = fakeMap()
  const q = createImportQueue({ pending, map: () => m.map, getToken: async () => 'jwt' })
  return { q, pending, trails, ...m, card: (i: number) => pending.value[i]! }
}

const file = (name: string, content = gpx('Flowline')) => new File([content], name)

describe('import queue', () => {
  it('adds GPX files as pending cards previewed in blue, skips non-GPX', async () => {
    const { q, pending, layers, fitAll } = setup()
    await q.addFiles([file('flow.gpx'), file('notes.txt'), file('NAMELESS.GPX', gpx(''))])
    expect(pending.value.map(p => [p.filename, p.name, p.difficulty, p.direction])).toEqual([
      ['flow.gpx', 'Flowline', 'blue', 'one-way-down'],
      ['NAMELESS.GPX', 'NAMELESS', 'blue', 'one-way-down'],
    ])
    expect(pending.value[0]!.processed.demCorrected).toBe(true)
    expect([...layers.values()]).toEqual([DIFF_COLOR.blue, DIFF_COLOR.blue])
    expect(fitAll).toHaveBeenCalledOnce()
  })

  it('recolours the preview when the difficulty changes, removes a card with its layer', async () => {
    const { q, pending, layers, card } = setup()
    await q.addFiles([file('a.gpx'), file('b.gpx')])
    card(1).difficulty = 'black'
    q.recolor(1)
    expect(layers.get(card(1).key)).toBe(DIFF_COLOR.black)
    const firstKey = card(0).key
    q.remove(0)
    expect(layers.has(firstKey)).toBe(false)
    expect(pending.value).toHaveLength(1)
  })

  it('clear() drops every pending card and its preview layer', async () => {
    const { q, pending, layers } = setup()
    await q.addFiles([file('a.gpx'), file('b.gpx')])
    q.clear()
    expect(pending.value).toEqual([])
    expect(layers.size).toBe(0)
  })

  it('upload: stores each GPX, inserts trails appended after the existing ones, swaps preview for trail layer', async () => {
    const { q, pending, trails, layers, card } = setup()
    await q.addFiles([file('a.gpx'), file('b.gpx')])
    card(0).name = '  Hangman  '
    card(1).name = ''
    card(1).difficulty = 'red'
    const errors = await q.upload('spot-1', trails)

    expect(errors).toEqual([])
    expect(uploads).toEqual(['spot-1/trails/Hangman.gpx', 'spot-1/trails/b.gpx'])
    expect(inserts.map(r => [r.name, r.difficulty, r.sort_order, r.spot_id])).toEqual([
      ['Hangman', 'blue', 1, 'spot-1'],
      ['b', 'red', 2, 'spot-1'],
    ])
    expect(trails.value.map(t => t.id)).toEqual(['old', 'new-1', 'new-2'])
    expect([...layers.keys()]).toEqual(['new-1', 'new-2'])
    expect(pending.value).toEqual([])
  })

  it('upload: one failing card is reported, the others still land', async () => {
    const { q, trails, card } = setup()
    await q.addFiles([file('a.gpx'), file('b.gpx')])
    card(0).name = 'Broken'
    failUploadFor = 'Broken'
    const errors = await q.upload('spot-1', trails)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/^Broken: GPX upload failed/)
    expect(inserts).toHaveLength(1)
    expect(trails.value).toHaveLength(2)
  })
})
