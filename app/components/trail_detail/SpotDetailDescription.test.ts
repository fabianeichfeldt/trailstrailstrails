import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Trail } from '~/types/Trail'
import { TrailDetails } from '~/types/TrailDetails'

// Split out of SpotDetailInfo.test.ts as part of splitting the former
// monolithic SpotDetailInfo.vue into per-section components: this one keeps
// id="beschreibung" (opening hours, general description, spotcheck/dirtpark
// badges, and the helpfulness-feedback block).
let fakeMapStore: { reportModalOpen: boolean; reportModalTrailId: string | null; reportModalTrailName: string | null }

vi.stubGlobal('useMapStore', () => fakeMapStore)
vi.mock('~/utils/feedback', () => ({ upVote: vi.fn(async () => {}), downVote: vi.fn(async () => {}) }))
vi.mock('~/utils/toast', () => ({ showToast: vi.fn() }))

import { upVote, downVote } from '~/utils/feedback'
import SpotDetailDescription from './SpotDetailDescription.vue'

function trail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: 't1', name: 'Flowtrail Tegernsee', type: 'trail',
    latitude: 1, longitude: 1, approved: true, url: '',
    creator: '', instagram: '', spotcheck: '', created_at: '',
    ...overrides,
  } as Trail
}

function details(overrides: Partial<TrailDetails> = {}): TrailDetails {
  const d = new TrailDetails('t1')
  Object.assign(d, overrides)
  return d
}

describe('SpotDetailDescription', () => {
  beforeEach(() => {
    fakeMapStore = { reportModalOpen: false, reportModalTrailId: null, reportModalTrailName: null }
    vi.mocked(upVote).mockClear()
    vi.mocked(downVote).mockClear()
  })

  it('renders the general description text', () => {
    const wrapper = mount(SpotDetailDescription, {
      props: { trail: trail(), details: details({ trail_description: 'A great flowy trail.' }) },
    })
    expect(wrapper.text()).toContain('A great flowy trail.')
  })

  it('renders the spotcheck badge when the trail has a spotcheck url', () => {
    const wrapper = mount(SpotDetailDescription, {
      props: { trail: trail({ spotcheck: 'https://example.com/spotcheck' }), details: details() },
    })
    const badge = wrapper.find('.spotcheck-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('href')).toBe('https://example.com/spotcheck')
  })

  it('calls upVote and shows a toast when the thumbs-up button is clicked', async () => {
    const wrapper = mount(SpotDetailDescription, { props: { trail: trail(), details: details() } })

    await wrapper.find('.thumb-btn.up').trigger('click')
    await Promise.resolve()

    expect(upVote).toHaveBeenCalledWith('t1', expect.any(HTMLElement))
  })

  it('calls downVote when the thumbs-down button is clicked', async () => {
    const wrapper = mount(SpotDetailDescription, { props: { trail: trail(), details: details() } })

    await wrapper.find('.thumb-btn.down').trigger('click')
    await Promise.resolve()

    expect(downVote).toHaveBeenCalledWith('t1', expect.any(HTMLElement))
  })

  it('opens the report modal with the current trail id/name', async () => {
    const wrapper = mount(SpotDetailDescription, { props: { trail: trail(), details: details() } })

    await wrapper.find('.report-error-link').trigger('click')

    expect(fakeMapStore.reportModalOpen).toBe(true)
    expect(fakeMapStore.reportModalTrailId).toBe('t1')
    expect(fakeMapStore.reportModalTrailName).toBe('Flowtrail Tegernsee')
  })
})
