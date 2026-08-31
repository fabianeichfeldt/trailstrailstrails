import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SpotPanelGpxMissingNotice from './SpotPanelGpxMissingNotice.vue'

describe('SpotPanelGpxMissingNotice', () => {
  it('shows the missing-GPX message and contact links', () => {
    const wrapper = mount(SpotPanelGpxMissingNotice)
    expect(wrapper.text()).toContain('Die GPX-Daten zu diesem Spot wurden noch nicht hochgeladen.')
    expect(wrapper.get('a[href="https://www.instagram.com/trailradar.germany"]').text()).toBe('@trailradar.germany')
    expect(wrapper.get('a[href="mailto:webmaster@trailradar.org"]').exists()).toBe(true)
  })
})
