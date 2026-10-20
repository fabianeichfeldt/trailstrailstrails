import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SPOT_TYPES, SPOT_TYPE_LIST, isSpotType, tagSpots, visibleFilter, type SpotType } from './SpotTypes'
import { SPOT_GPX_SECTIONS } from './Trail'
import { SPOT_CAPABILITIES } from '../spot_manager/spotTypes'
import { markerIconOptions } from '../map/markerIcon'
import { resolveSpot, getTrailDetails } from '../communication/trails'
import { createPinia, setActivePinia } from 'pinia'
import { useFiltersStore } from '../stores/filters'

const REST_BASE = 'http://localhost:54321/rest/v1'

const EXPECT: Record<SpotType, { table: string; details: string; eyebrow: string; gpx: [boolean, boolean]; marker: string; endpoint: string }> = {
  trail:    { table: 'trails',     details: 'trail_details',     eyebrow: 'Trail',               gpx: [true, true],   marker: 'verified', endpoint: 'trail-details?trail=' },
  bikepark: { table: 'parks',      details: 'bike_park_details', eyebrow: 'Bikepark',            gpx: [true, false],  marker: 'bikepark', endpoint: 'bike-parks-details?id=' },
  dirtpark: { table: 'dirt_parks', details: 'dirt_park_details', eyebrow: 'Dirtpark / Pumptrack', gpx: [false, false], marker: 'dirtpark', endpoint: 'dirt-parks-details?id=' },
}

describe('SPOT_TYPES registry', () => {
  it('has exactly the known types, keyed by their own type', () => {
    expect(SPOT_TYPE_LIST.map(d => d.type)).toEqual(['trail', 'bikepark', 'dirtpark'])
    for (const [k, d] of Object.entries(SPOT_TYPES)) expect(d.type).toBe(k)
  })
  it('isSpotType / tagSpots', () => {
    expect(isSpotType('bikepark')).toBe(true)
    expect(isSpotType('toString')).toBe(false)
    expect(tagSpots('dirtpark', [{ id: 'a' }])).toEqual([{ id: 'a', type: 'dirtpark' }])
    expect(visibleFilter(SPOT_TYPES.trail)).toBe('&visible=eq.true')
    expect(visibleFilter(SPOT_TYPES.bikepark)).toBe('')
  })

  describe.each(Object.keys(EXPECT) as SpotType[])('%s', (type) => {
    const e = EXPECT[type]
    const row = { id: `${type}-1`, slug: `${type}-slug`, name: 'X', latitude: 1, longitude: 2, approved: true }

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        const path = String(url).split('/rest/v1/')[1] ?? ''
        const table = path.split('?')[0] ?? ''
        // Mocks ignore eq filters on purpose, like tests/fixtures.ts
        const rows: Record<string, unknown[]> = {
          [e.table]: [row],
          [e.details]: [{ id: row.id, trail_id: row.id, status: 'open' }],
        }
        return { ok: true, json: async () => rows[table] ?? [] }
      }))
    })

    it('holds the per-type facts', () => {
      const d = SPOT_TYPES[type]
      expect(d.table).toBe(e.table)
      expect(d.detailsTable).toBe(e.details)
      expect(d.eyebrow).toBe(e.eyebrow)
      expect(SPOT_GPX_SECTIONS[type]).toEqual({ trails: e.gpx[0], tours: e.gpx[1] })
      expect(SPOT_CAPABILITIES[type]).toMatchObject({ table: e.table, detailsTable: e.details, trails: e.gpx[0], tours: e.gpx[1] })
    })

    it('resolveSpot finds it by id and by slug with its type, details and photos', async () => {
      for (const [field, value] of [['id', row.id], ['slug', row.slug]] as const) {
        const res = await resolveSpot(field, value)
        expect(res).toMatchObject({ id: row.id, type, status: 'open', photos: [] })
      }
      expect(await resolveSpot('slug', 'nope')).toBeNull()
    })

    it('marker category', () => {
      expect(markerIconOptions(type, true).html).toContain(`map-pin-${e.marker}`)
    })

    it('details endpoint is called for getTrailDetails', async () => {
      const f = vi.fn(async () => ({ ok: false, json: async () => ({}) }))
      vi.stubGlobal('fetch', f)
      await getTrailDetails({ ...row, type } as never)
      expect(String((f.mock.calls[0] as unknown[])[0])).toContain(e.endpoint + row.id)
    })

    it('filter toggle hides exactly this type', () => {
      setActivePinia(createPinia())
      const s = useFiltersStore()
      const item = { ...row, type } as never
      expect(s.apply([item])).toHaveLength(1)
      ;(s as any)[SPOT_TYPES[type].filterKey] = false
      expect(s.apply([item])).toHaveLength(0)
    })
  })

  it('pumptrack dirtparks follow showPumptracks, not showDirtparks', () => {
    setActivePinia(createPinia())
    const s = useFiltersStore()
    const pump = { id: 'p', type: 'dirtpark', pumptrack: true } as never
    s.showDirtparks = false
    expect(s.apply([pump])).toHaveLength(1)
    s.showDirtparks = true
    s.showPumptracks = false
    expect(s.apply([pump])).toHaveLength(0)
  })

  it('filter keeps rows with an unknown type instead of throwing', () => {
    setActivePinia(createPinia())
    const s = useFiltersStore()
    expect(s.apply([{ id: 'x', type: 'constructor' } as never])).toHaveLength(1)
  })

  it('resolveSpot: trail wins a slug clash', async () => {
    const row = { id: 'clash', slug: 'same-slug' }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const table = (String(url).split('/rest/v1/')[1] ?? '').split('?')[0]
      return { ok: true, json: async () => (table === 'trails' || table === 'parks' ? [row] : []) }
    }))
    expect(await resolveSpot('slug', 'same-slug')).toMatchObject({ type: 'trail' })
  })
})
