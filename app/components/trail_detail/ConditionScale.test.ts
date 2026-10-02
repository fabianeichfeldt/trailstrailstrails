import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import ConditionScale from './ConditionScale.vue'

const LABELS = ['Staubig', 'Trocken', 'Perfekt', 'Feucht', 'Schlammig']

describe('ConditionScale — read-only', () => {
  it('draws one track with a fill positioned over the range and labelled ticks below it', () => {
    const wrapper = mount(ConditionScale, { props: { range: { lo: 1, hi: 2 } } })
    const ticks = wrapper.findAll('.cs-tick')

    expect(ticks.map((t) => t.text())).toEqual(LABELS)
    expect(ticks.map((t) => t.classes().includes('on'))).toEqual([false, true, true, false, false])

    const fill = wrapper.find('.cs-fill')
    expect(fill.attributes('style')).toContain('left: 20%')
    expect(fill.attributes('style')).toContain('width: 40%')
  })

  it('renders the new Trocken tick on and fills its one-fifth slice', () => {
    const wrapper = mount(ConditionScale, { props: { range: { lo: 1, hi: 1 } } })
    const ticks = wrapper.findAll('.cs-tick')

    expect(ticks.map((t) => t.classes().includes('on'))).toEqual([false, true, false, false, false])

    const fill = wrapper.find('.cs-fill')
    expect(fill.attributes('style')).toContain('left: 20%')
    expect(fill.attributes('style')).toContain('width: 20%')
  })

  it('positions a single-level range as one fifth-width slice', () => {
    const wrapper = mount(ConditionScale, { props: { range: { lo: 4, hi: 4 } } })
    const fill = wrapper.find('.cs-fill')
    expect(fill.attributes('style')).toContain('left: 80%')
    expect(fill.attributes('style')).toContain('width: 20%')
  })

  it('has no buttons and describes the range to assistive technology', () => {
    const wrapper = mount(ConditionScale, { props: { range: { lo: 1, hi: 2 }, label: 'Unsere Schätzung' } })

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(wrapper.text()).toContain('Unsere Schätzung')
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe('Unsere Schätzung: Trocken bis Perfekt')
  })

  it('names a single-segment range once', () => {
    const wrapper = mount(ConditionScale, { props: { range: { lo: 4, hi: 4 }, label: 'Unsere Schätzung' } })
    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe('Unsere Schätzung: Schlammig')
  })

  it('uses the continuous positionRange for the fill geometry when given, narrower than the block range', () => {
    const wrapper = mount(ConditionScale, {
      props: { range: { lo: 1, hi: 2 }, positionRange: { lo: 1.4, hi: 2.6 } },
    })
    const fill = wrapper.find('.cs-fill')
    expect(fill.attributes('style')).toContain('left: 28%')
    expect(fill.attributes('style')).toContain('width: 24%')
  })

  it('falls back to the discrete block geometry when positionRange is omitted or null', () => {
    const withoutProp = mount(ConditionScale, { props: { range: { lo: 1, hi: 2 } } })
    const withNull = mount(ConditionScale, { props: { range: { lo: 1, hi: 2 }, positionRange: null } })

    for (const wrapper of [withoutProp, withNull]) {
      const fill = wrapper.find('.cs-fill')
      expect(fill.attributes('style')).toContain('left: 20%')
      expect(fill.attributes('style')).toContain('width: 40%')
    }
  })
})

describe('ConditionScale — interactive', () => {
  it('renders one real button per level with a label and aria-pressed, plus the track/fill/ticks', () => {
    const wrapper = mount(ConditionScale, { props: { range: { lo: 1, hi: 2 }, interactive: true } })
    const buttons = wrapper.findAll('button')

    expect(buttons).toHaveLength(5)
    expect(buttons.map((b) => b.attributes('type'))).toEqual(['button', 'button', 'button', 'button', 'button'])
    expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'true', 'true', 'false', 'false'])
    expect(buttons.map((b) => b.attributes('aria-label'))).toEqual(LABELS)

    expect(wrapper.find('.cs-fill').exists()).toBe(true)
    expect(wrapper.findAll('.cs-tick').map((t) => t.classes().includes('on'))).toEqual([false, true, true, false, false])
  })

  it('emits the tapped index (a native button is also keyboard operable)', async () => {
    const wrapper = mount(ConditionScale, { props: { range: { lo: 1, hi: 2 }, interactive: true } })
    await wrapper.findAll('button')[4]!.trigger('click')
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[4], [0]])
  })

  it('shows a busy state while the model range is loading', () => {
    const wrapper = mount(ConditionScale, { props: { range: { lo: 1, hi: 2 }, interactive: true, loading: true } })
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.classes()).toContain('loading')
  })

  it('keeps the invisible hit buttons at least 44px tall even though the visible bar is thin', () => {
    const src = readFileSync(resolve(__dirname, 'ConditionScale.vue'), 'utf8')
    expect(src).toMatch(/\.cs-hit[^{]*\{[^}]*min-height:\s*(4[4-9]|[5-9]\d)px/)
  })
})
