import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Suspense, defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import { TrailDetails } from '~/types/TrailDetails'

// Mocked at the network boundary (communication/) — the real spotPanel
// store runs, so these tests see what the page sees.
vi.mock('~/communication/trails', () => ({
  getTrailBySlug: vi.fn(),
  getTrailById: vi.fn(),
  getTrailDetails: vi.fn(),
  getSpotGpxData: vi.fn(),
  fetchMultipleSpotParking: vi.fn(),
}))
vi.mock('~/communication/comments', () => ({
  getComments: vi.fn(),
  getOlderComments: vi.fn(),
  postComment: vi.fn(),
  deleteComment: vi.fn(),
  COMMENTS_PAGE_SIZE: 20,
}))
vi.mock('~/communication/photos', () => ({ isSpotAssignedToTrailcrew: vi.fn() }))

import { getTrailById, getTrailBySlug, getTrailDetails, getSpotGpxData, fetchMultipleSpotParking, type ResolvedSpot } from '~/communication/trails'
import { getComments } from '~/communication/comments'
import { isSpotAssignedToTrailcrew } from '~/communication/photos'
import { useSpotDetail } from './useSpotDetail'

// Minimal stand-in for Nuxt's useAsyncData: `data`/`refresh` are available
// synchronously and the result is awaitable, like the real one. Runs the
// handler once (the "SSR payload"); refresh() re-runs it.
function fakeUseAsyncData(_key: string, handler: () => Promise<unknown>) {
  const data = ref<unknown>(null)
  const refresh = async () => { data.value = await handler() }
  const done = refresh().then(() => ({ data, refresh }))
  return { data, refresh, then: done.then.bind(done) }
}

const navigateTo = vi.fn()
const clearNuxtData = vi.fn()
let fakeAuth: { isLoggedIn: boolean; userId: string; isAdmin: boolean; isTrailcrew: boolean; nickname: string; avatarUrl: string; getToken: () => Promise<string> }

function spotRow(id: string, extra: Record<string, unknown> = {}): ResolvedSpot {
  return { id, slug: `${id}-slug`, name: `Spot ${id}`, type: 'trail', latitude: 1, longitude: 1, description: `baked ${id}`, photos: [], ...extra } as unknown as ResolvedSpot
}

function liveDetails(id: string, extra: Partial<TrailDetails> = {}): TrailDetails {
  return Object.assign(new TrailDetails(id), { description: `live ${id}`, ...extra })
}

type Result = Awaited<ReturnType<typeof useSpotDetail>>

async function mountDetail(slug: string | null) {
  let result!: Result
  const Probe = defineComponent({
    async setup() {
      result = await useSpotDetail(slug)
      return () => h('div')
    },
  })
  mount({ render: () => h(Suspense, null, { default: () => h(Probe) }) })
  await flushPromises()
  return result
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('useAsyncData', fakeUseAsyncData)
  vi.stubGlobal('navigateTo', navigateTo)
  vi.stubGlobal('clearNuxtData', clearNuxtData)
  vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)
  fakeAuth = { isLoggedIn: false, userId: '', isAdmin: false, isTrailcrew: false, nickname: '', avatarUrl: '', getToken: async () => '' }
  vi.stubGlobal('useAuthStore', () => fakeAuth)

  navigateTo.mockReset()
  clearNuxtData.mockReset()
  vi.mocked(getTrailBySlug).mockReset().mockResolvedValue(null)
  vi.mocked(getTrailById).mockReset().mockResolvedValue(null)
  vi.mocked(getTrailDetails).mockReset().mockImplementation(async t => liveDetails(t.id))
  vi.mocked(getSpotGpxData).mockReset().mockResolvedValue(null)
  vi.mocked(fetchMultipleSpotParking).mockReset().mockResolvedValue(new Map())
  vi.mocked(getComments).mockReset().mockResolvedValue([])
  vi.mocked(isSpotAssignedToTrailcrew).mockReset().mockResolvedValue(false)
})

describe('useSpotDetail', () => {
  it('resolves a spot by slug, refreshes it after mount and loads the live per-spot data', async () => {
    vi.mocked(getTrailBySlug).mockResolvedValue(spotRow('t1'))

    const { spot, details } = await mountDetail('t1-slug')

    expect(spot.value?.id).toBe('t1')
    expect(clearNuxtData).toHaveBeenCalledWith('trail-t1-slug')
    expect(getTrailBySlug).toHaveBeenCalledTimes(2) // SSR payload + post-mount refresh
    expect(getComments).toHaveBeenCalledOnce()
    expect(getComments).toHaveBeenCalledWith('t1')
    expect(fetchMultipleSpotParking).toHaveBeenCalledOnce()
    expect(getTrailDetails).toHaveBeenCalledOnce()
    expect(details.value.description).toBe('live t1')
    expect(useSpotPanelStore().currentItem?.id).toBe('t1')
  })

  it('301s a legacy id URL to the spot\'s slug', async () => {
    vi.mocked(getTrailById).mockResolvedValue(spotRow('abc', { slug: 'flowtrail' }))

    const { spot } = await mountDetail('abc')

    expect(getTrailById).toHaveBeenCalledWith('abc')
    expect(navigateTo).toHaveBeenCalledWith('/trails/flowtrail/', { redirectCode: 301, replace: true })
    expect(spot.value?.id).toBe('abc')
  })

  it('returns no spot and loads nothing when the slug matches nothing', async () => {
    const { spot } = await mountDetail('nope')

    expect(spot.value).toBeNull()
    expect(navigateTo).not.toHaveBeenCalled()
    expect(getComments).not.toHaveBeenCalled()
    expect(getTrailDetails).not.toHaveBeenCalled()
  })

  it('does nothing for region pages (null slug)', async () => {
    const asyncDataSpy = vi.fn(fakeUseAsyncData)
    vi.stubGlobal('useAsyncData', asyncDataSpy)

    const { spot } = await mountDetail(null)

    expect(spot.value).toBeNull()
    expect(asyncDataSpy).not.toHaveBeenCalled() // no shared 'trail-null' payload key
    expect(getTrailBySlug).not.toHaveBeenCalled()
    expect(clearNuxtData).not.toHaveBeenCalled()
  })

  it('starts the live loads when the spot only appears in the post-mount refresh', async () => {
    // Spot created after the last deploy: the baked payload has nothing.
    vi.mocked(getTrailBySlug).mockResolvedValueOnce(null).mockResolvedValue(spotRow('new'))

    const { spot, details } = await mountDetail('new-slug')

    expect(spot.value?.id).toBe('new')
    expect(getComments).toHaveBeenCalledOnce()
    expect(getTrailDetails).toHaveBeenCalledOnce()
    expect(details.value.description).toBe('live new')
  })

  it('marks the spot liked when the signed-in user is among its likes', async () => {
    fakeAuth.userId = 'u1'
    vi.mocked(getTrailBySlug).mockResolvedValue(spotRow('t1'))
    vi.mocked(getTrailDetails).mockResolvedValue(liveDetails('t1', { likes: [{ user_id: 'u1' }] as TrailDetails['likes'] }))

    await mountDetail('t1-slug')

    const store = useSpotPanelStore()
    expect(store.likeVisible).toBe(true)
    expect(store.isLiked).toBe(true)
  })

  it('checks photo moderation with the caller\'s identity', async () => {
    fakeAuth.userId = 'crew'
    fakeAuth.isTrailcrew = true
    vi.mocked(isSpotAssignedToTrailcrew).mockResolvedValue(true)
    vi.mocked(getTrailBySlug).mockResolvedValue(spotRow('t1'))

    await mountDetail('t1-slug')

    expect(isSpotAssignedToTrailcrew).toHaveBeenCalledWith('t1', expect.anything())
    expect(useSpotPanelStore().photosCanModerate).toBe(true)
  })

  it('reloads for the new spot and drops a late details answer for the old one', async () => {
    let currentRow = spotRow('a')
    vi.mocked(getTrailBySlug).mockImplementation(async () => currentRow)
    let resolveA!: (d: TrailDetails) => void
    vi.mocked(getTrailDetails)
      .mockImplementationOnce(() => new Promise(r => { resolveA = r }))
      .mockImplementation(async t => liveDetails(t.id))

    const result = await mountDetail('a-slug')
    // Client-side nav to another spot — the same page instance gets new data.
    currentRow = spotRow('b')
    result.trail.value = currentRow
    await flushPromises()
    resolveA(liveDetails('a'))
    await flushPromises()

    expect(result.spot.value?.id).toBe('b')
    expect(result.details.value.description).toBe('live b')
    expect(getComments).toHaveBeenLastCalledWith('b')
    expect(useSpotPanelStore().currentItem?.id).toBe('b')
  })

  it('removePhoto splices a deleted photo out of details', async () => {
    vi.mocked(getTrailBySlug).mockResolvedValue(spotRow('t1'))
    vi.mocked(getTrailDetails).mockResolvedValue(liveDetails('t1', { photos: [{ id: 'p1' }, { id: 'p2' }] as TrailDetails['photos'] }))

    const { details, removePhoto } = await mountDetail('t1-slug')
    removePhoto('p1')

    expect(details.value.photos.map(p => p.id)).toEqual(['p2'])
  })
})
