import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SpotDetailSummary from './SpotDetailSummary.vue'

describe('SpotDetailSummary', () => {
  it('renders the fact line', () => {
    expect(mount(SpotDetailSummary, { props: { text: 'X ist ein Trail.' } }).text()).toBe('X ist ein Trail.')
  })
  it('renders nothing when empty', () => {
    expect(mount(SpotDetailSummary, { props: { text: '' } }).find('p').exists()).toBe(false)
  })
})
