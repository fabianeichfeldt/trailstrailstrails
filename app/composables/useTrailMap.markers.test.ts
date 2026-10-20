import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFiltersStore } from '~/stores/filters'
import type { Trail } from '~/types/Trail'
import type { SoilMapSpot } from '~/types/SoilMap'
import type { ConditionLevel } from '~/types/Weather'
import {
  markerPins, pinIconOptions, soilChips,
  type SoilInput,
} from '~/map/markerPresentation'

// useTrailMap's wiring: filtersStore.apply() decides type visibility, markerPresentation the soil look.
const FULL = { lo: 0, hi: 4 }
const WORLD = { south: -90, north: 90, west: -180, east: 180 }

function spot(type: Trail['type'], id: string, extra: Partial<Trail> = {}): Trail {
  return {
    name: id, id, slug: id, creator: '', url: '', instagram: '', spotcheck: '', created_at: '',
    latitude: 48, longitude: 11, approved: true, type, pumptrack: false, dirtpark: true, ...extra,
  } as Trail
}

function soil(over: Partial<SoilInput> & { verdicts?: Record<string, ConditionLevel> } = {}): SoilInput {
  const { verdicts = {}, ...rest } = over
  return {
    enabled: true, mode: 'live', range: FULL, points: [],
    verdictFor: (t, id) => verdicts[`${t}:${id}`],
    ...rest,
  }
}

const sample = (lvl: ConditionLevel, lat = 48, lon = 11): SoilMapSpot =>
  ({ t: 'trail', id: `s-${lvl}`, lat, lon, lvl, lo: null, hi: null })

describe('markerPins — filter × soil', () => {
  let filters: ReturnType<typeof useFiltersStore>
  const all = [spot('trail', 't1'), spot('bikepark', 'b1'), spot('dirtpark', 'd1'), spot('dirtpark', 'p1', { pumptrack: true } as Partial<Trail>)]
  const pins = (s: SoilInput) => markerPins(filters.apply(all), s)

  beforeEach(() => {
    setActivePinia(createPinia())
    filters = useFiltersStore()
  })

  it('radar off: every type-visible spot gets a plain, clickable pin', () => {
    filters.showBikeparks = false
    const out = pins(soil({ enabled: false, verdicts: { 'trail:t1': 'wet' } }))
    expect(out.map(p => p.trail?.id)).toEqual(['t1', 'd1', 'p1'])
    expect(out.every(p => p.level === undefined && !p.ghost)).toBe(true)
    expect(pinIconOptions(out[0]!).html).not.toContain('soil-badge')
  })

  it('live mode: verdict badges, ghosting by range, type filter still applies', () => {
    filters.showPumptracks = false
    const out = pins(soil({ range: { lo: 0, hi: 2 }, verdicts: { 'trail:t1': 'prime', 'bikepark:b1': 'wet' } }))
    expect(out.map(p => [p.trail?.id, p.level, p.ghost])).toEqual([
      ['t1', 'prime', false],
      ['b1', 'wet', true],
      ['d1', undefined, false],
    ])
    expect(pinIconOptions(out[1]!).className).toContain('soil-ghost')
    expect(pinIconOptions(out[0]!).html).toContain('soil-badge')
  })

  it('sample mode hides the real pins, even with every type filter on', () => {
    const out = pins(soil({ mode: 'sample', points: [sample('dry'), sample('wet')], range: { lo: 0, hi: 2 } }))
    expect(out).toHaveLength(2)
    expect(out.every(p => p.trail === null)).toBe(true)
    expect(out.map(p => p.ghost)).toEqual([false, true])
  })

  it('sample mode ignores the type filter (demo pins are not real spots)', () => {
    filters.showTrails = false
    const out = pins(soil({ mode: 'sample', points: [sample('dry')] }))
    expect(out).toHaveLength(1)
  })

  it('sample mode while the radar is off falls back to the real pins', () => {
    const out = pins(soil({ enabled: false, mode: 'sample', points: [sample('dry')] }))
    expect(out.map(p => p.trail?.id)).toEqual(['t1', 'b1', 'd1', 'p1'])
  })

  it('intro centre gives pop delays only to pins with a badge', () => {
    const out = markerPins(filters.apply(all), soil({ verdicts: { 'trail:t1': 'dry' } }), { lat: 47, lon: 11 })
    expect(out[0]!.delayMs).toBeTypeOf('number')
    expect(out[1]!.delayMs).toBeUndefined()
    expect(markerPins(filters.apply(all), soil({ verdicts: { 'trail:t1': 'dry' } }))[0]!.delayMs).toBeUndefined()
  })
})

describe('soilChips', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('one chip per in-view, type-visible spot with a verdict; ghosted outside the range', () => {
    const filters = useFiltersStore()
    filters.showBikeparks = false
    const all = [
      spot('trail', 'in'), spot('trail', 'out', { latitude: 10 }),
      spot('trail', 'none'), spot('bikepark', 'hidden'),
    ]
    const chips = soilChips(filters.apply(all), soil({
      range: { lo: 3, hi: 4 },
      verdicts: { 'trail:in': 'dry', 'trail:out': 'dry', 'bikepark:hidden': 'dry' },
    }), { south: 40, north: 50, west: 0, east: 20 })
    expect(chips).toHaveLength(1)
    expect(chips[0]!.icon.className).toContain('soil-ghost')
    expect(chips[0]!.icon.iconAnchor).toEqual([46, -4])
  })

  it('sample mode chips come from the demo points; radar off yields none', () => {
    expect(soilChips([], soil({ mode: 'sample', points: [sample('prime')] }), WORLD)).toHaveLength(1)
    expect(soilChips([spot('trail', 't')], soil({ enabled: false, verdicts: { 'trail:t': 'dry' } }), WORLD)).toEqual([])
  })
})

