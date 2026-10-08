import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import SoilRadarPanel from './SoilRadarPanel.vue'

type Fresh = { computedAt: string; stale: boolean; offline: boolean } | null
let store: { range: { lo: number; hi: number }; mode: 'live' | 'sample'; freshness: Fresh; setRange: ReturnType<typeof vi.fn> }
vi.stubGlobal('useSoilRadarStore', () => store)

function mountPanel() {
  return mount(SoilRadarPanel, { attachTo: document.body })
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
  it('says what the map shows, so a first-time viewer understands the legend', () => {
    const w = mountPanel()
    const title = w.get('[data-testid="soil-title"]')
    expect(title.text()).toBe('Wie ist der Boden gerade?')
    expect(w.get('[data-testid="soil-panel"]').attributes('aria-labelledby')).toBe(title.attributes('id'))
  })

  it('lists the five levels', () => {
    const labels = mountPanel().findAll('.tick-label').map(t => t.text())
    expect(labels).toEqual(['Staubig', 'Trocken', 'Hero Dirt', 'Feucht', 'Schlammig'])
  })

  it('is a legend only: no range sliders, no counter', () => {
    const w = mountPanel()
    expect(w.findAll('[role="slider"]')).toHaveLength(0)
    expect(w.find('[data-testid="soil-counter"]').exists()).toBe(false)
  })

  it('clears a range narrowed earlier, since there is no slider left to undo it', () => {
    store.range = { lo: 2, hi: 3 }
    mountPanel()
    expect(store.setRange).toHaveBeenCalledWith(0, 4)
  })

  it('leaves a full range alone', () => {
    mountPanel()
    expect(store.setRange).not.toHaveBeenCalled()
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
