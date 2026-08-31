import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { TrailDetails } from '~/types/TrailDetails'
import SpotDetailVideo from './SpotDetailVideo.vue'

// Split out of SpotDetailInfo.test.ts as its own top-level section, placed
// last on the page per the drastic-redesign order.
function details(overrides: Partial<TrailDetails> = {}): TrailDetails {
  const d = new TrailDetails('t1')
  Object.assign(d, overrides)
  return d
}

describe('SpotDetailVideo', () => {
  it('renders nothing when there are no videos', () => {
    const wrapper = mount(SpotDetailVideo, { props: { details: details() } })
    expect(wrapper.find('#video').exists()).toBe(false)
  })

  it('shows the YouTube consent thumbnail first, then loads the iframe on click', async () => {
    const wrapper = mount(SpotDetailVideo, {
      props: {
        details: details({
          videos: [{ url: 'https://youtube.com/embed/abc', creator: 'https://youtube.com/@someone' } as any],
        }),
      },
    })

    expect(wrapper.find('.yt-thumb').exists()).toBe(true)
    expect(wrapper.find('iframe').exists()).toBe(false)

    await wrapper.find('.yt-load-btn').trigger('click')

    expect(wrapper.find('.yt-thumb').exists()).toBe(false)
    expect(wrapper.find('iframe').attributes('src')).toBe('https://youtube.com/embed/abc')
  })
})
