import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import SoilRadarPanel from './SoilRadarPanel.vue'

type Fresh = { computedAt: string; stale: boolean; offline: boolean } | null
let store: { range: { lo: number; hi: number }; mode: 'live' | 'sample'; freshness: Fresh; setRange: ReturnType<typeof vi.fn> }
vi.stubGlobal('useSoilRadarStore', () => store)

// Ramp is 400 px wide starting at x=0 so one axis step is 100 px.
function mountPanel(props = { matchCount: 21, totalCount: 46 }) {
  const w = mount(SoilRadarPanel, { props, attachTo: document.body })
  w.get('[data-testid="soil-ramp"]').element.getBoundingClientRect = () =>
    ({ left: 0, width: 400, right: 400, top: 0, height: 16, bottom: 16, x: 0, y: 0, toJSON() {} }) as DOMRect
  return w
}

beforeEach(() => {
  store = reactive({
    range: { lo: 0, hi: 4 }, mode: 'live' as const, freshness: null as Fresh,
    setRange: vi.fn((lo: number, hi: number) => { store.range = { lo, hi } }),
  })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-07T13:30:00Z')) // 15:30 Berlin, Wednesday
})
afterEach(() => vi.useRealTimers())

describe('SoilRadarPanel', () => {
  it('shows the five tick labels and the counter chip', () => {
    const w = mountPanel()
    const labels = w.findAll('.tick-label').map(t => t.text())
    expect(labels).toEqual(['Staubig', 'Trocken', 'Hero Dirt', 'Feucht', 'Schlammig'])
    expect(w.get('[data-testid="soil-counter"]').text()).toBe('21 von 46 Spots')
  })

  it('has two sliders with aria values', () => {
    store.range = { lo: 1, hi: 3 }
    const [lo, hi] = mountPanel().findAll('[role="slider"]')
    expect(lo!.attributes('aria-valuemin')).toBe('0')
    expect(lo!.attributes('aria-valuemax')).toBe('4')
    expect(lo!.attributes('aria-valuenow')).toBe('1')
    expect(hi!.attributes('aria-valuenow')).toBe('3')
    expect(lo!.attributes('aria-valuetext')).toBe('Trocken')
  })

  it('arrow keys move a handle by one step', async () => {
    const [lo, hi] = mountPanel().findAll('[role="slider"]')
    await hi!.trigger('keydown', { key: 'ArrowLeft' })
    expect(store.setRange).toHaveBeenLastCalledWith(0, 3)
    await lo!.trigger('keydown', { key: 'ArrowRight' })
    expect(store.setRange).toHaveBeenLastCalledWith(1, 3)
  })

  it('handles cannot cross', async () => {
    store.range = { lo: 2, hi: 2 }
    const [lo, hi] = mountPanel().findAll('[role="slider"]')
    await lo!.trigger('keydown', { key: 'ArrowRight' })
    await hi!.trigger('keydown', { key: 'ArrowLeft' })
    expect(store.setRange).not.toHaveBeenCalled()
  })

  it('dragging a handle snaps to the nearest step', async () => {
    const w = mountPanel()
    const hi = w.findAll('[role="slider"]')[1]!
    await hi.trigger('pointerdown', { clientX: 400, pointerId: 1 })
    await hi.trigger('pointermove', { clientX: 290, pointerId: 1 })
    expect(store.setRange).toHaveBeenLastCalledWith(0, 3)
    await hi.trigger('pointerup', { pointerId: 1 })
    store.setRange.mockClear()
    await hi.trigger('pointermove', { clientX: 100, pointerId: 1 })
    expect(store.setRange).not.toHaveBeenCalled()
  })

  it('tapping the ramp moves the nearest handle', async () => {
    store.range = { lo: 0, hi: 4 }
    const w = mountPanel()
    await w.get('[data-testid="soil-ramp"]').trigger('pointerdown', { clientX: 90, pointerId: 1 })
    expect(store.setRange).toHaveBeenLastCalledWith(1, 4)
  })

  it('shows freshness in Berlin time', () => {
    store.freshness = { computedAt: '2026-10-07T13:00:00Z', stale: false, offline: false }
    expect(mountPanel().get('[data-testid="soil-fresh"]').text()).toBe('Stand 15:00')
  })

  it('shows weekday and offline marker for an older offline snapshot', () => {
    store.freshness = { computedAt: '2026-10-05T16:00:00Z', stale: false, offline: true }
    expect(mountPanel().get('[data-testid="soil-fresh"]').text()).toBe('Stand Mo 18:00 · offline')
  })

  it('flags stale data in amber', () => {
    store.freshness = { computedAt: '2026-10-05T16:00:00Z', stale: true, offline: false }
    const el = mountPanel().get('[data-testid="soil-fresh"]')
    expect(el.text()).toContain('Daten veraltet')
    expect(el.classes()).toContain('is-stale')
  })

  it('sample mode shows the Beispielansicht pill and no freshness', () => {
    store.mode = 'sample'
    const w = mountPanel()
    expect(w.get('[data-testid="soil-sample-pill"]').text()).toBe('Beispielansicht')
    expect(w.find('[data-testid="soil-fresh"]').exists()).toBe(false)
  })

  it('has no sample pill in live mode', () => {
    expect(mountPanel().find('[data-testid="soil-sample-pill"]').exists()).toBe(false)
  })
})
