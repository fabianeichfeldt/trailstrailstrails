import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSpotEditorLoader, loadSpotForEditing } from './spotEditorLoader'

// Fake PostgREST at the fetch boundary: answers by table + id, each response
// held until the test releases that spot (to stage out-of-order arrivals).
type Rows = Record<string, unknown[]>
let db: Record<string, Rows>
let held: Set<string>
let failing: Set<string>
let waiting: Array<{ spotId: string; release: () => void }>
let requested: string[]

function spotIdOf(url: string): string {
  return url.match(/(?:spot_id|trail_id|id)=eq\.([^&]+)/)![1]!
}

beforeEach(() => {
  db = {}
  held = new Set()
  failing = new Set()
  waiting = []
  requested = []
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const url = String(input)
    const table = url.match(/\/rest\/v1\/([a-z_]+)/)![1]!
    const spotId = spotIdOf(url)
    requested.push(table)
    if (held.has(spotId)) await new Promise<void>(release => waiting.push({ spotId, release }))
    if (failing.has(spotId)) throw new Error('offline')
    const body = db[spotId]?.[table] ?? []
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
  }))
})

function release(spotId: string) {
  held.delete(spotId)
  for (const w of waiting.filter(w => w.spotId === spotId)) w.release()
  waiting = waiting.filter(w => w.spotId !== spotId)
}

const flush = () => new Promise(r => setTimeout(r, 0))

const trail = (id: string, name: string) => ({ id, spot_id: 'x', name, sort_order: 0 })

describe('loadSpotForEditing — capability driven', () => {
  it('trail spot: trails, tours, trail details and parking; no park details', async () => {
    db.t1 = {
      spot_gpx_trails: [trail('g1', 'Flow')], spot_gpx_tours: [{ id: 'r1', name: 'Runde' }],
      trail_details: [{ trail_id: 't1', status: 'closed' }], parking: [{ id: 'p1', name: 'P1' }],
    }
    const d = await loadSpotForEditing({ id: 't1', type: 'trail' })
    expect(d.trails.map(t => t.name)).toEqual(['Flow'])
    expect(d.tours).toHaveLength(1)
    expect(d.spotDetails?.status).toBe('closed')
    expect(d.parkDetails).toBeNull()
    expect(d.parkingLots).toHaveLength(1)
    expect(requested).not.toContain('bike_park_details')
  })

  it('bikepark: trails + bike_park_details, never tours or trail_details', async () => {
    db.b1 = { spot_gpx_trails: [trail('g1', 'Jump Line')], bike_park_details: [{ id: 'b1', status: 'open' }] }
    const d = await loadSpotForEditing({ id: 'b1', type: 'bikepark' })
    expect(d.trails).toHaveLength(1)
    expect(d.parkDetails?.status).toBe('open')
    expect(d.spotDetails).toBeNull()
    expect(requested.sort()).toEqual(['bike_park_details', 'parking', 'spot_gpx_trails'])
  })

  it('dirtpark: no GPX at all, details from dirt_park_details', async () => {
    db.d1 = { dirt_park_details: [{ id: 'd1', status: 'closed' }] }
    const d = await loadSpotForEditing({ id: 'd1', type: 'dirtpark' })
    expect(d.parkDetails?.status).toBe('closed')
    expect(requested.sort()).toEqual(['dirt_park_details', 'parking'])
  })

  it('park details are fetched alongside the rest, not after it', async () => {
    held.add('b1')
    const p = loadSpotForEditing({ id: 'b1', type: 'bikepark' })
    await flush()
    expect(requested).toContain('bike_park_details')
    release('b1')
    await p
  })
})

describe('createSpotEditorLoader — stale guard', () => {
  it('opening spot B while A is still loading never shows A’s data on B', async () => {
    db.A = { spot_gpx_trails: [trail('a', 'A-Trail')], bike_park_details: [{ id: 'A', status: 'closed' }] }
    db.B = { spot_gpx_trails: [trail('b', 'B-Trail')], bike_park_details: [{ id: 'B', status: 'open' }] }
    const loader = createSpotEditorLoader()
    // Mirror the component: whatever load() hands back is what gets shown.
    let shown: string | undefined
    const show = (d: Awaited<ReturnType<typeof loader.load>>) => { if (d) shown = d.trails[0]?.name }

    held.add('A')
    const a = loader.load({ id: 'A', type: 'bikepark' }).then(show)
    await flush()
    await loader.load({ id: 'B', type: 'bikepark' }).then(show)
    expect(shown).toBe('B-Trail')

    release('A')
    await a
    expect(shown).toBe('B-Trail')
  })

  it('a superseded load that fails is dropped, not reported', async () => {
    const loader = createSpotEditorLoader()
    held.add('A')
    const a = loader.load({ id: 'A', type: 'trail' })
    await flush()
    await loader.load({ id: 'B', type: 'trail' })
    failing.add('A')
    release('A')
    await expect(a).resolves.toBeNull()
  })

  it('cancel() drops the in-flight load (user left the spot)', async () => {
    db.A = { spot_gpx_trails: [trail('a', 'A-Trail')] }
    const loader = createSpotEditorLoader()
    held.add('A')
    const a = loader.load({ id: 'A', type: 'trail' })
    await flush()
    loader.cancel()
    release('A')
    await expect(a).resolves.toBeNull()
  })

  it('the current load’s error still surfaces', async () => {
    failing.add('A')
    await expect(createSpotEditorLoader().load({ id: 'A', type: 'trail' })).rejects.toThrow('offline')
  })
})
