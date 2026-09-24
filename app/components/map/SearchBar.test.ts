import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import SearchBar from './SearchBar.vue'

// SearchBar renders in two places: floating over the Leaflet map and pinned to
// the landing page's map teaser. The whole point of sharing one component is
// that the two cannot drift apart visually, so these tests assert that the
// `variant` prop changes nothing but the variant class — everything the user
// sees (input row, dropdown, groups, rows) is the same markup with the same
// class names in both.
//
// The trails store is faked (the real one needs a live Supabase client);
// Nominatim is mocked at `fetch`.

const SPOTS = [
  { id: 't1', name: 'Flowtrail Tegernsee', type: 'trail' },
  { id: 'b1', name: 'Flowpark Lenggries', type: 'bikepark' },
]

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('useTrailsStore', () => ({
    trails: SPOTS.filter(s => s.type === 'trail'),
    bikeparks: SPOTS.filter(s => s.type === 'bikepark'),
    dirtparks: [],
    ensureLoaded: vi.fn().mockResolvedValue(undefined),
  }))
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }))
})

// No vi.unstubAllGlobals() — it would also drop vitest.setup.ts's ref/computed
// stubs that stand in for Nuxt's auto-imports.
afterEach(() => {
  vi.useRealTimers()
})

async function mountWithQuery(props: Record<string, unknown>, query = 'Flow') {
  const wrapper = mount(SearchBar, { props })
  await wrapper.get('[data-testid="search-input"]').setValue(query)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
  return wrapper
}

/** The variant class is the one difference we allow between the two renders. */
function withoutVariantClass(wrapper: VueWrapper<any>) {
  return wrapper.html().replace(/search-wrapper--(map|teaser)/g, 'search-wrapper--VARIANT')
}

describe('SearchBar variants', () => {
  it('defaults to the map variant', () => {
    const wrapper = mount(SearchBar)
    expect(wrapper.get('.search-wrapper').classes()).toContain('search-wrapper--map')
  })

  it('marks the teaser variant with its own class', () => {
    const wrapper = mount(SearchBar, { props: { variant: 'teaser' } })
    const classes = wrapper.get('.search-wrapper').classes()
    expect(classes).toContain('search-wrapper--teaser')
    expect(classes).not.toContain('search-wrapper--map')
  })

  it('renders identical idle DOM in both variants apart from the variant class', () => {
    const map = mount(SearchBar, { props: { variant: 'map' } })
    const teaser = mount(SearchBar, { props: { variant: 'teaser' } })
    expect(withoutVariantClass(teaser)).toBe(withoutVariantClass(map))
  })

  it('renders identical result DOM in both variants apart from the variant class', async () => {
    const map = await mountWithQuery({ variant: 'map' })
    const teaser = await mountWithQuery({ variant: 'teaser' })

    expect(map.find('[data-testid="search-results"]').exists()).toBe(true)
    expect(withoutVariantClass(teaser)).toBe(withoutVariantClass(map))
  })

  it('renders identical empty-state DOM in both variants apart from the variant class', async () => {
    const map = await mountWithQuery({ variant: 'map' }, 'gibtesnicht')
    const teaser = await mountWithQuery({ variant: 'teaser' }, 'gibtesnicht')

    expect(map.get('[data-testid="search-results"]').text()).toContain('Keine Ergebnisse')
    expect(withoutVariantClass(teaser)).toBe(withoutVariantClass(map))
  })

  it.each(['map', 'teaser'] as const)('uses the shared class names and test ids in the %s variant', async (variant) => {
    const wrapper = await mountWithQuery({ variant })

    for (const selector of [
      '[data-testid="search-input"]',
      '[data-testid="search-clear"]',
      '[data-testid="search-results"]',
      '.search-input-row',
      '.search-result-separator',
      '.search-result-item',
      '.search-result-icon',
      '.search-result-text',
      '.search-result-name',
      '.search-result-sub',
    ]) {
      expect(wrapper.find(selector).exists(), `${selector} missing in variant ${variant}`).toBe(true)
    }
  })
})

describe('SearchBar emits', () => {
  it.each(['map', 'teaser'] as const)('emits openTrail with the spot id when a spot row is clicked (%s)', async (variant) => {
    const wrapper = await mountWithQuery({ variant })

    await wrapper.findAll('.search-result-item')[0].trigger('click')

    expect(wrapper.emitted('openTrail')).toEqual([['t1']])
  })

  it.each(['map', 'teaser'] as const)('emits flyTo with the place coordinates when a place row is clicked (%s)', async (variant) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ display_name: 'Tegernsee, Bayern, Deutschland', lat: '47.71', lon: '11.76' }],
    }))
    const wrapper = await mountWithQuery({ variant })

    const rows = wrapper.findAll('.search-result-item')
    await rows[rows.length - 1].trigger('click')

    expect(wrapper.emitted('flyTo')).toEqual([[47.71, 11.76]])
  })

  it('clears the input and dropdown after a pick', async () => {
    const wrapper = await mountWithQuery({ variant: 'teaser' })

    await wrapper.findAll('.search-result-item')[0].trigger('click')
    await flushPromises()

    expect((wrapper.get('[data-testid="search-input"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('[data-testid="search-results"]').exists()).toBe(false)
  })

  it('no longer ships the dead mobile search toggle', () => {
    const wrapper = mount(SearchBar)
    expect(wrapper.find('#search-toggle').exists()).toBe(false)
  })
})
