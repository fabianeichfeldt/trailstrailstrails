import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { TrailDetails } from '~/types/TrailDetails'
import SpotDetailRules from './SpotDetailRules.vue'

// Split out of SpotDetailInfo.test.ts as its own top-level section (was
// previously rendered inline inside the description card).
function details(overrides: Partial<TrailDetails> = {}): TrailDetails {
  const d = new TrailDetails('t1')
  Object.assign(d, overrides)
  return d
}

describe('SpotDetailRules', () => {
  it('renders nothing when there are no rules', () => {
    const wrapper = mount(SpotDetailRules, { props: { details: details() } })
    expect(wrapper.find('#regeln').exists()).toBe(false)
  })

  it('renders each rule as its own line', () => {
    const wrapper = mount(SpotDetailRules, {
      props: { details: details({ rules: ['Keine Musik', 'Helmpflicht'] }) },
    })
    expect(wrapper.text()).toContain('Keine Musik')
    expect(wrapper.text()).toContain('Helmpflicht')
  })
})
