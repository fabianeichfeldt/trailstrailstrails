import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mocked at the module boundary — never hit a real Supabase URL in tests
// (CLAUDE.md's test mandate).
vi.mock('~/communication/trails', () => ({
  fetchMultipleSpotParking: vi.fn(),
  getSpotGpxData: vi.fn(),
}))

// Mocked rather than mocking ~/stores/auth (which would drag in
// useSupabaseClient/useSupabaseUser, only real inside a live Nuxt app) — the
// store takes identity as a plain CommentsAuthInfo/IAuthService argument
// instead of owning an auth source.
vi.mock('~/communication/comments', () => ({
  getComments: vi.fn(),
  getOlderComments: vi.fn(),
  postComment: vi.fn(),
  deleteComment: vi.fn(),
  COMMENTS_PAGE_SIZE: 20,
}))

import { fetchMultipleSpotParking, getSpotGpxData, type SpotParkingLot } from '~/communication/trails'
import { getComments, getOlderComments, postComment, deleteComment } from '~/communication/comments'
import { useSpotPanelStore, type CommentsAuthInfo } from './spotPanel'
import type { Trail } from '~/types/Trail'
import type { Comment } from '~/types/Comment'
import type { IAuthService } from '~/auth/auth_service'
import type { SpotMtbData, MtbTrail, MtbTour } from '~/types/MtbTypes'

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1, created_at: '2026-08-01T00:00:00Z', spot_id: 's1', user_id: 'u1',
    comment_text: 'Trail war heute top in Schuss!',
    profiles: { display_name: 'Alice', avatar_url: '' },
    ...overrides,
  }
}

const authInfo: CommentsAuthInfo = { userId: 'u1', isAdmin: false, isTrailcrew: false }

function fakeAuthService(): IAuthService {
  return { getUser: vi.fn().mockResolvedValue({ id: 'u1', accessToken: 'tok' }) } as unknown as IAuthService
}

function trail(id: string, type: Trail['type'] = 'trail'): Trail {
  return { id, name: 'Testspot', type, latitude: 1, longitude: 1, approved: true } as Trail
}

describe('useSpotPanelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchMultipleSpotParking).mockReset()
    // load() fire-and-forgets loadParking() on every call — default to an
    // empty resolved Map so tests that don't care about the parking fetch
    // (e.g. state-reset tests) don't hit the try/catch's console.warn for
    // an unmocked undefined return value. Tests that DO care override this
    // per-case.
    vi.mocked(fetchMultipleSpotParking).mockResolvedValue(new Map())
    vi.mocked(getSpotGpxData).mockReset()
    vi.mocked(getComments).mockReset()
    vi.mocked(getOlderComments).mockReset()
    vi.mocked(postComment).mockReset()
    vi.mocked(deleteComment).mockReset()
  })

  it('starts with empty defaults', () => {
    const store = useSpotPanelStore()
    expect(store.currentItem).toBeNull()
    expect(store.parkingLots).toEqual([])
    expect(store.comments).toEqual([])
    expect(store.commentsExpanded).toBe(false)
    expect(store.commentsHasMore).toBe(false)
    expect(store.commentsLoaded).toBe(false)
    expect(store.commentsCurrentUserId).toBe('')
    expect(store.commentsCanModerate).toBe(false)
    expect(store.data).toBeNull()
    expect(store.selectedItemId).toBeNull()
    expect(store.selectedItemKind).toBeNull()
    expect(store.isLiked).toBe(false)
    expect(store.likeVisible).toBe(false)
  })

  it('loadParking fetches lots for the given spot and stores them', async () => {
    const store = useSpotPanelStore()
    store.currentItem = trail('s1')
    const lots: SpotParkingLot[] = [{ id: 'p1', name: 'Lot A', lat: 1, lng: 1, info: ['Kostenlos'] }]
    vi.mocked(fetchMultipleSpotParking).mockResolvedValue(new Map([['s1', lots]]))

    await store.loadParking('s1')

    expect(fetchMultipleSpotParking).toHaveBeenCalledWith(['s1'])
    expect(store.parkingLots).toEqual(lots)
  })

  it('stores an empty list when the spot has no parking lots', async () => {
    const store = useSpotPanelStore()
    store.currentItem = trail('s1')
    vi.mocked(fetchMultipleSpotParking).mockResolvedValue(new Map())

    await store.loadParking('s1')

    expect(store.parkingLots).toEqual([])
  })

  it('bails out without overwriting state if the panel moved to a different spot while the fetch was in flight', async () => {
    const store = useSpotPanelStore()
    store.currentItem = trail('s1')
    let resolveFetch!: (value: Map<string, SpotParkingLot[]>) => void
    vi.mocked(fetchMultipleSpotParking).mockReturnValue(
      new Promise(resolve => { resolveFetch = resolve }),
    )

    const pending = store.loadParking('s1')
    // Panel moved on to a different spot before the fetch resolved.
    store.currentItem = trail('s2')
    store.parkingLots = [{ id: 'stale-guard', name: 'should not be overwritten', lat: 0, lng: 0 }]

    resolveFetch(new Map([['s1', [{ id: 'p1', name: 'Lot A', lat: 1, lng: 1 }]]]))
    await pending

    expect(store.parkingLots).toEqual([{ id: 'stale-guard', name: 'should not be overwritten', lat: 0, lng: 0 }])
  })

  it('bails out without overwriting state if currentItem cleared while the fetch was in flight', async () => {
    const store = useSpotPanelStore()
    store.currentItem = trail('s1')
    let resolveFetch!: (value: Map<string, SpotParkingLot[]>) => void
    vi.mocked(fetchMultipleSpotParking).mockReturnValue(
      new Promise(resolve => { resolveFetch = resolve }),
    )

    const pending = store.loadParking('s1')
    store.currentItem = null

    resolveFetch(new Map([['s1', [{ id: 'p1', name: 'Lot A', lat: 1, lng: 1 }]]]))
    await pending

    expect(store.parkingLots).toEqual([])
  })

  it('logs and leaves parkingLots untouched when the fetch rejects', async () => {
    const store = useSpotPanelStore()
    store.currentItem = trail('s1')
    store.parkingLots = [{ id: 'existing', name: 'Existing Lot', lat: 0, lng: 0 }]
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(fetchMultipleSpotParking).mockRejectedValue(new Error('network error'))

    await store.loadParking('s1')

    expect(store.parkingLots).toEqual([{ id: 'existing', name: 'Existing Lot', lat: 0, lng: 0 }])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  // ── Comments ─────────────────────────────────────────────────────────
  describe('loadComments', () => {
    it('fetches comments for the given spot and stores identity info from authInfo', async () => {
      const store = useSpotPanelStore()
      store.currentItem = trail('s1')
      vi.mocked(getComments).mockResolvedValue([comment()])

      await store.loadComments('s1', { userId: 'u1', isAdmin: true, isTrailcrew: false })

      expect(getComments).toHaveBeenCalledWith('s1')
      expect(store.comments).toEqual([comment()])
      expect(store.commentsCurrentUserId).toBe('u1')
      expect(store.commentsCanModerate).toBe(true)
      expect(store.commentsLoaded).toBe(true)
    })

    it('sets commentsHasMore when a full page comes back', async () => {
      const store = useSpotPanelStore()
      store.currentItem = trail('s1')
      const fullPage = Array.from({ length: 20 }, (_, i) => comment({ id: i + 1 }))
      vi.mocked(getComments).mockResolvedValue(fullPage)

      await store.loadComments('s1', authInfo)

      expect(store.commentsHasMore).toBe(true)
    })

    it('auto-expands when 3 or fewer comments come back', async () => {
      const store = useSpotPanelStore()
      store.currentItem = trail('s1')
      vi.mocked(getComments).mockResolvedValue([comment(), comment({ id: 2 })])

      await store.loadComments('s1', authInfo)

      expect(store.commentsExpanded).toBe(true)
    })

    it('stays collapsed by default with more than 3 comments', async () => {
      const store = useSpotPanelStore()
      store.currentItem = trail('s1')
      vi.mocked(getComments).mockResolvedValue([1, 2, 3, 4].map(id => comment({ id })))

      await store.loadComments('s1', authInfo)

      expect(store.commentsExpanded).toBe(false)
    })

    it('bails out without overwriting state if the panel moved to a different spot while the fetch was in flight', async () => {
      const store = useSpotPanelStore()
      store.currentItem = trail('s1')
      let resolveFetch!: (value: Comment[]) => void
      vi.mocked(getComments).mockReturnValue(new Promise(resolve => { resolveFetch = resolve }))

      const pending = store.loadComments('s1', authInfo)
      store.currentItem = trail('s2')
      store.comments = [comment({ id: 999, comment_text: 'should not be overwritten' })]

      resolveFetch([comment()])
      await pending

      expect(store.comments).toEqual([comment({ id: 999, comment_text: 'should not be overwritten' })])
    })

    it('logs and leaves comments untouched when the fetch rejects', async () => {
      const store = useSpotPanelStore()
      store.currentItem = trail('s1')
      store.comments = [comment({ id: 999 })]
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(getComments).mockRejectedValue(new Error('network error'))

      await store.loadComments('s1', authInfo)

      expect(store.comments).toEqual([comment({ id: 999 })])
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('loadMoreComments', () => {
    it('fetches comments older than the current oldest and appends them', async () => {
      const store = useSpotPanelStore()
      store.currentItem = trail('s1')
      store.comments = [comment({ id: 5, created_at: '2026-08-05T00:00:00Z' })]
      const older = [comment({ id: 4, created_at: '2026-08-04T00:00:00Z' })]
      vi.mocked(getOlderComments).mockResolvedValue(older)

      await store.loadMoreComments()

      expect(getOlderComments).toHaveBeenCalledWith('s1', '2026-08-05T00:00:00Z')
      expect(store.comments).toEqual([comment({ id: 5, created_at: '2026-08-05T00:00:00Z' }), ...older])
    })

    it('does nothing when there is no current item or no comments loaded yet', async () => {
      const store = useSpotPanelStore()
      await store.loadMoreComments()
      expect(getOlderComments).not.toHaveBeenCalled()
    })

    it('bails out without appending if the panel moved to a different spot while the fetch was in flight', async () => {
      const store = useSpotPanelStore()
      store.currentItem = trail('s1')
      store.comments = [comment({ id: 5 })]
      let resolveFetch!: (value: Comment[]) => void
      vi.mocked(getOlderComments).mockReturnValue(new Promise(resolve => { resolveFetch = resolve }))

      const pending = store.loadMoreComments()
      store.currentItem = trail('s2')

      resolveFetch([comment({ id: 4 })])
      await pending

      expect(store.comments).toEqual([comment({ id: 5 })])
    })
  })

  describe('postComment', () => {
    it('posts the comment and prepends it to the list', async () => {
      const store = useSpotPanelStore()
      store.currentItem = trail('s1')
      const posted = comment({ id: 42, comment_text: 'Neu!' })
      vi.mocked(postComment).mockResolvedValue(posted)

      const result = await store.postComment('Neu!', fakeAuthService())

      expect(postComment).toHaveBeenCalledWith('s1', 'Neu!', expect.anything())
      expect(store.comments[0]).toEqual(posted)
      expect(result).toEqual(posted)
    })

    it('throws without calling the API when no spot is open', async () => {
      const store = useSpotPanelStore()
      await expect(store.postComment('Neu!', fakeAuthService())).rejects.toThrow()
      expect(postComment).not.toHaveBeenCalled()
    })

    it('propagates the error and leaves the list untouched when the API call fails', async () => {
      const store = useSpotPanelStore()
      store.currentItem = trail('s1')
      store.comments = [comment({ id: 1 })]
      vi.mocked(postComment).mockRejectedValue(new Error('rate limited'))

      await expect(store.postComment('Neu!', fakeAuthService())).rejects.toThrow('rate limited')
      expect(store.comments).toEqual([comment({ id: 1 })])
    })
  })

  describe('deleteComment', () => {
    it('deletes the comment and removes it from the list', async () => {
      const store = useSpotPanelStore()
      store.comments = [comment({ id: 1 }), comment({ id: 2 })]
      vi.mocked(deleteComment).mockResolvedValue(undefined)

      await store.deleteComment(1, fakeAuthService())

      expect(deleteComment).toHaveBeenCalledWith(1, expect.anything())
      expect(store.comments).toEqual([comment({ id: 2 })])
    })

    it('propagates the error and leaves the list untouched when the API call fails', async () => {
      const store = useSpotPanelStore()
      store.comments = [comment({ id: 1 })]
      vi.mocked(deleteComment).mockRejectedValue(new Error('forbidden'))

      await expect(store.deleteComment(1, fakeAuthService())).rejects.toThrow('forbidden')
      expect(store.comments).toEqual([comment({ id: 1 })])
    })
  })

  describe('toggleCommentsExpanded', () => {
    it('flips commentsExpanded', () => {
      const store = useSpotPanelStore()
      expect(store.commentsExpanded).toBe(false)
      store.toggleCommentsExpanded()
      expect(store.commentsExpanded).toBe(true)
      store.toggleCommentsExpanded()
      expect(store.commentsExpanded).toBe(false)
    })
  })

  // ── Tours + Trails + Elevation ───────────────────────────────────────
  function baseTrail(overrides: Partial<MtbTrail> = {}): MtbTrail {
    return {
      id: 'trail-1', spotId: 's1', name: 'Testtrail', difficulty: 'blue',
      distance_km: 3, elevation_gain: 100, elevation_loss: 300,
      direction: 'one-way-down', gpxPoints: [], elevationProfile: [],
      ...overrides,
    }
  }

  function baseTour(overrides: Partial<MtbTour> = {}): MtbTour {
    return {
      id: 'tour-1', spotId: 's1', name: 'Testtour',
      distance_km: 5, elevation_gain: 200, elevation_loss: 400,
      direction: 'cw', duration_minutes: 60, trailCount: 2,
      segments: [], gpxPoints: [], elevationProfile: [], hasFullGpx: true,
      ...overrides,
    }
  }

  function spotData(overrides: Partial<SpotMtbData> = {}): SpotMtbData {
    return { spotId: 's1', tours: [baseTour()], trails: [baseTrail()], ...overrides }
  }

  describe('loadSpotData', () => {
    it('fetches GPX data for the given spot and stores it', async () => {
      const store = useSpotPanelStore()
      const result = spotData()
      vi.mocked(getSpotGpxData).mockResolvedValue(result)

      await store.loadSpotData('s1')

      expect(getSpotGpxData).toHaveBeenCalledWith('s1')
      expect(store.data).toEqual(result)
    })

    it('stores null when the fetch resolves with no data', async () => {
      const store = useSpotPanelStore()
      vi.mocked(getSpotGpxData).mockResolvedValue(null)

      await store.loadSpotData('s1')

      expect(store.data).toBeNull()
    })

    it('logs and leaves data untouched when the fetch rejects', async () => {
      const store = useSpotPanelStore()
      store.data = spotData({ spotId: 'existing' })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(getSpotGpxData).mockRejectedValue(new Error('network error'))

      await store.loadSpotData('s1')

      expect(store.data).toEqual(spotData({ spotId: 'existing' }))
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  describe('selectItem', () => {
    it('sets selectedItemId/selectedItemKind for a trail', () => {
      const store = useSpotPanelStore()
      store.selectItem('trail-1', 'trail')
      expect(store.selectedItemId).toBe('trail-1')
      expect(store.selectedItemKind).toBe('trail')
    })

    it('sets selectedItemId/selectedItemKind for a tour, overwriting a previous trail selection', () => {
      const store = useSpotPanelStore()
      store.selectItem('trail-1', 'trail')
      store.selectItem('tour-1', 'tour')
      expect(store.selectedItemId).toBe('tour-1')
      expect(store.selectedItemKind).toBe('tour')
    })
  })

  // ── Routed spot-detail page ─────────────────────────────────────────
  describe('load', () => {
    it('sets currentItem and resets per-spot state', () => {
      const store = useSpotPanelStore()
      store.parkingLots = [{ id: 'p1', name: 'Old lot', lat: 1, lng: 1 }]
      store.comments = [comment()]
      store.commentsExpanded = true
      store.commentsLoaded = true
      store.isLiked = true
      store.likeVisible = true
      store.selectedItemId = 'trail-1'
      store.selectedItemKind = 'trail'

      store.load(trail('s2'))

      expect(store.currentItem?.id).toBe('s2')
      expect(store.parkingLots).toEqual([])
      expect(store.comments).toEqual([])
      expect(store.commentsExpanded).toBe(false)
      expect(store.commentsLoaded).toBe(false)
      expect(store.isLiked).toBe(false)
      expect(store.likeVisible).toBe(false)
      expect(store.selectedItemId).toBeNull()
      expect(store.selectedItemKind).toBeNull()
    })

    it('fetches parking and GPX data for a trail-type spot', async () => {
      const store = useSpotPanelStore()
      vi.mocked(fetchMultipleSpotParking).mockResolvedValue(new Map([['s2', [{ id: 'p1', name: 'Lot', lat: 1, lng: 1 }]]]))
      vi.mocked(getSpotGpxData).mockResolvedValue({ spotId: 's2', tours: [], trails: [] })

      store.load(trail('s2', 'trail'))
      await Promise.resolve()
      await Promise.resolve()

      expect(fetchMultipleSpotParking).toHaveBeenCalledWith(['s2'])
      expect(getSpotGpxData).toHaveBeenCalledWith('s2')
      expect(store.parkingLots).toEqual([{ id: 'p1', name: 'Lot', lat: 1, lng: 1 }])
      expect(store.data).toEqual({ spotId: 's2', tours: [], trails: [] })
    })

    it('fetches parking but not GPX tour/trail data for a non-trail spot', async () => {
      const store = useSpotPanelStore()

      store.load(trail('b1', 'bikepark'))
      await Promise.resolve()

      expect(fetchMultipleSpotParking).toHaveBeenCalledWith(['b1'])
      expect(getSpotGpxData).not.toHaveBeenCalled()
    })
  })

  describe('clearSelection', () => {
    it('clears selectedItemId/selectedItemKind', () => {
      const store = useSpotPanelStore()
      store.selectItem('trail-1', 'trail')
      store.clearSelection()
      expect(store.selectedItemId).toBeNull()
      expect(store.selectedItemKind).toBeNull()
    })
  })
})
