import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useTrailsStore } from '~/stores/trails'

// The regression test for the feature itself: a visitor on the landing page
// types into the teaser searchbar and ends up on the map with the picked spot.
//
// It drives the real user flow through the real component stack — MapTeaser →
// SearchBar → useSpotSearch → the real trails store → communication/places.ts
// — and mocks only the network boundary (`fetch`) plus the two Nuxt injections
// that have no meaning outside a live Nuxt app (`useSupabaseClient`,
// `useRuntimeConfig`, `useRouter`). Nothing about the search internals is
// asserted; only what the user gets.

const SUPABASE_URL = 'http://localhost:54321'

const MOCK_TRAILS = [
  { id: 't1', slug: 't1', name: 'Flowtrail Tegernsee', latitude: 47.71, longitude: 11.76, approved: true },
  { id: 't2', slug: 't2', name: 'Waldpfad Ingolstadt', latitude: 48.76, longitude: 11.42, approved: true },
]
const MOCK_PARKS = [
  { id: 'b1', slug: 'b1', name: 'Bikepark Lenggries', latitude: 47.68, longitude: 11.56, approved: true },
]
const MOCK_DIRTPARKS = [
  { id: 'd1', slug: 'd1', name: 'Pumptrack München', latitude: 48.14, longitude: 11.57, approved: true, pumptrack: true, dirtpark: false },
]

// Renders as a real <a> so the "searchbar must not live inside a link"
// assertion below is actually meaningful.
const NuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
})

let push: ReturnType<typeof vi.fn>
let places: unknown[]

vi.stubGlobal('useSupabaseClient', () => ({}))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { supabase: { url: SUPABASE_URL, key: 'test-anon-key' } } }))
vi.stubGlobal('useTrailsStore', useTrailsStore)

function mockNetwork() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    if (url.includes('nominatim')) return jsonResponse(places)
    if (url.includes('/rest/v1/trails')) return jsonResponse(MOCK_TRAILS)
    if (url.includes('/rest/v1/parks')) return jsonResponse(MOCK_PARKS)
    if (url.includes('/rest/v1/dirt_parks')) return jsonResponse(MOCK_DIRTPARKS)
    throw new Error(`[test] unmocked request to ${url}`)
  }))
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

import MapTeaser from './MapTeaser.vue'

let wrapper: VueWrapper<any>

function mountTeaser() {
  return mount(MapTeaser, { global: { stubs: { NuxtLink: NuxtLinkStub } } })
}

/** Types into the teaser searchbar and waits for the debounce + responses. */
async function search(w: VueWrapper<any>, query: string) {
  await w.get('[data-testid="search-input"]').setValue(query)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  push = vi.fn()
  places = []
  vi.stubGlobal('useRouter', () => ({ push }))
  mockNetwork()
})

afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
})

describe('MapTeaser — searching from the landing page', () => {
  it('sends the visitor to the map with the picked spot opened', async () => {
    wrapper = mountTeaser()

    await search(wrapper, 'Flow')

    const row = wrapper.findAll('.search-result-item')[0]
    expect(row.text()).toContain('Flowtrail Tegernsee')

    await row.trigger('click')

    expect(push).toHaveBeenCalledWith('/map?trail=t1')
  })

  it('finds bikeparks and pumptracks too, not just trails', async () => {
    wrapper = mountTeaser()

    await search(wrapper, 'Pumptrack')
    await wrapper.findAll('.search-result-item')[0].trigger('click')

    expect(push).toHaveBeenCalledWith('/map?trail=d1')
  })

  it('sends the visitor to the map centred on a picked place', async () => {
    places = [{ display_name: 'Tegernsee, Bayern, Deutschland', lat: '47.71', lon: '11.76' }]
    wrapper = mountTeaser()

    await search(wrapper, 'Tegernsee')

    const rows = wrapper.findAll('.search-result-item')
    const placeRow = rows[rows.length - 1]
    expect(placeRow.text()).toContain('Tegernsee')

    await placeRow.trigger('click')

    expect(push).toHaveBeenCalledWith('/map?fly=47.71,11.76')
  })

  it('loads the spot lists lazily — nothing is fetched until the visitor searches', async () => {
    wrapper = mountTeaser()
    await flushPromises()

    expect((globalThis.fetch as any).mock.calls).toHaveLength(0)

    await search(wrapper, 'Flow')

    expect((globalThis.fetch as any).mock.calls.length).toBeGreaterThan(0)
  })

  it('fetches the spot lists only once across focus and typing', async () => {
    wrapper = mountTeaser()

    await wrapper.get('[data-testid="search-input"]').trigger('focus')
    await search(wrapper, 'Flow')
    await search(wrapper, 'Waldpfad')

    const spotRequests = (globalThis.fetch as any).mock.calls
      .map((c: any[]) => (typeof c[0] === 'string' ? c[0] : c[0].url))
      .filter((u: string) => u.includes('/rest/v1/trails'))
    expect(spotRequests).toHaveLength(1)
  })
})

describe('MapTeaser — structure', () => {
  // Locks in the restructure this feature needed: the teaser used to be one
  // big <NuxtLink>, which makes an <input> invalid HTML and swallows every
  // click aimed at it. The link is now the CTA overlay inside the preview.
  it('does not nest the searchbar inside a link', () => {
    wrapper = mountTeaser()

    const input = wrapper.get('[data-testid="search-input"]').element
    expect(input.closest('a')).toBeNull()
    expect(wrapper.get('.search-wrapper').element.closest('a')).toBeNull()
  })

  it('keeps the whole map preview clickable as the link to /map', () => {
    wrapper = mountTeaser()

    const overlay = wrapper.get('a.map-cta-overlay')
    expect(overlay.attributes('href')).toBe('/map')
    expect(overlay.text()).toContain('Zur Karte')
  })

  it('places the searchbar outside the overflow-hidden teaser box so the dropdown is not clipped', () => {
    wrapper = mountTeaser()

    const searchbar = wrapper.get('.search-wrapper').element
    expect(searchbar.closest('.map-teaser')).toBeNull()
    // Its own slot inside the wrap — the slot is what lines the bar up with the
    // top of the map preview instead of with the fake browser chrome.
    expect(searchbar.closest('.teaser-search-slot')).not.toBeNull()
    expect(searchbar.closest('.map-teaser-wrap')).not.toBeNull()
  })

  it('renders the searchbar in its teaser variant', () => {
    wrapper = mountTeaser()

    expect(wrapper.get('.search-wrapper').classes()).toContain('search-wrapper--teaser')
  })
})
