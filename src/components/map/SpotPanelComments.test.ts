import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useSpotPanelStore } from '~/stores/spotPanel'
import type { Comment } from '~/types/Comment'

// SpotPanelComments.vue relies on Nuxt's implicit auto-imports for the
// Pinia stores it reads (useSpotPanelStore/useAuthStore/useMapStore) — see
// vitest.setup.ts for ref/watch/onMounted/defineStore stubs. useSpotPanelStore
// is stubbed with the *real* implementation (plain Pinia, no Supabase
// dependency — see spotPanel.ts's CommentsAuthInfo doc comment); useAuthStore
// is a minimal fake since the real store pulls in useSupabaseClient/
// useSupabaseUser, only available inside a live Nuxt app. Same pattern as
// ReportErrorModal.test.ts / Drawer.test.ts.
let fakeAuthStore: {
  isLoggedIn: boolean
  userId: string
  isAdmin: boolean
  isTrailcrew: boolean
  nickname: string
  avatarUrl: string
  getToken: () => Promise<string>
}
let fakeMapStore: { authModalOpen: boolean }

vi.stubGlobal('useSpotPanelStore', useSpotPanelStore)
vi.stubGlobal('useAuthStore', () => fakeAuthStore)
vi.stubGlobal('useMapStore', () => fakeMapStore)

vi.mock('~/map/confirmDialog', () => ({ confirmDialog: vi.fn() }))
vi.mock('~/utils/toast', () => ({ showToast: vi.fn() }))
vi.mock('~/communication/comments', () => ({
  getComments: vi.fn(),
  getOlderComments: vi.fn(),
  postComment: vi.fn(),
  deleteComment: vi.fn(),
  COMMENTS_PAGE_SIZE: 20,
}))

import { confirmDialog } from '~/map/confirmDialog'
import { showToast } from '~/utils/toast'
import { postComment, deleteComment } from '~/communication/comments'
import SpotPanelComments from './SpotPanelComments.vue'

function baseComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1, created_at: '2026-08-01T00:00:00Z', spot_id: 's1', user_id: 'u1',
    comment_text: 'Trail war heute top in Schuss!',
    profiles: { display_name: 'Alice', avatar_url: '' },
    ...overrides,
  }
}

describe('SpotPanelComments', () => {
  let wrapper: VueWrapper<any>
  let store: ReturnType<typeof useSpotPanelStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSpotPanelStore()
    fakeAuthStore = {
      isLoggedIn: true, userId: 'u1', isAdmin: false, isTrailcrew: false,
      nickname: 'TestRider', avatarUrl: '', getToken: vi.fn().mockResolvedValue('tok'),
    }
    fakeMapStore = { authModalOpen: false }
    vi.mocked(postComment).mockReset()
    vi.mocked(deleteComment).mockReset()
    vi.mocked(confirmDialog).mockReset()
    vi.mocked(showToast).mockReset()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('collapsed: shows only the count toggle, no list or write box', () => {
    store.comments = [baseComment()]
    store.commentsExpanded = false
    wrapper = mount(SpotPanelComments)

    expect(wrapper.find('.comments-header').exists()).toBe(true)
    expect(wrapper.text()).toContain('1 Kommentar')
    expect(wrapper.find('.comments-list').exists()).toBe(false)
    expect(wrapper.find('.comments-write-box').exists()).toBe(false)
  })

  it('uses singular "Kommentar" for exactly one, plural "Kommentare" otherwise', () => {
    store.comments = [baseComment()]
    wrapper = mount(SpotPanelComments)
    expect(wrapper.get('.comments-count').text()).toContain('1 Kommentar')
    wrapper.unmount()

    store.comments = []
    wrapper = mount(SpotPanelComments)
    expect(wrapper.get('.comments-count').text()).toContain('0 Kommentare')
    wrapper.unmount()

    store.comments = [baseComment({ id: 1 }), baseComment({ id: 2 })]
    wrapper = mount(SpotPanelComments)
    expect(wrapper.get('.comments-count').text()).toContain('2 Kommentare')
  })

  it('appends a "+" to the count when more comments exist than the loaded page', () => {
    store.comments = [baseComment()]
    store.commentsHasMore = true
    wrapper = mount(SpotPanelComments)
    expect(wrapper.get('.comments-count').text()).toContain('1+ Kommentar')
  })

  it('shows an empty-state message when expanded with no comments', () => {
    store.comments = []
    store.commentsExpanded = true
    wrapper = mount(SpotPanelComments)
    expect(wrapper.text()).toContain('Noch keine Kommentare')
  })

  it('expanded: renders author, date and text for each comment', () => {
    store.comments = [baseComment({ comment_text: 'Super Trail!' })]
    store.commentsExpanded = true
    wrapper = mount(SpotPanelComments)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Super Trail!')
  })

  it('escapes HTML in comment text and author name (Vue text interpolation, no v-html)', () => {
    store.comments = [baseComment({
      comment_text: '<img src=x onerror=alert(1)>',
      profiles: { display_name: '<b>Mallory</b>', avatar_url: '' },
    })]
    store.commentsExpanded = true
    wrapper = mount(SpotPanelComments)
    expect(wrapper.html()).not.toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.html()).not.toContain('<b>Mallory</b>')
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    expect(wrapper.text()).toContain('<b>Mallory</b>')
  })

  it('shows a delete control for the comment author, even when not a moderator', () => {
    store.comments = [baseComment({ user_id: 'u1' })]
    store.commentsExpanded = true
    store.commentsCurrentUserId = 'u1'
    store.commentsCanModerate = false
    wrapper = mount(SpotPanelComments)
    expect(wrapper.find('.comment-delete-btn').exists()).toBe(true)
  })

  it('shows a delete control for a moderator on someone else\'s comment', () => {
    store.comments = [baseComment({ user_id: 'other' })]
    store.commentsExpanded = true
    store.commentsCurrentUserId = 'u1'
    store.commentsCanModerate = true
    wrapper = mount(SpotPanelComments)
    expect(wrapper.find('.comment-delete-btn').exists()).toBe(true)
  })

  it('hides the delete control for a non-author, non-moderator viewer', () => {
    store.comments = [baseComment({ user_id: 'other' })]
    store.commentsExpanded = true
    store.commentsCurrentUserId = 'u1'
    store.commentsCanModerate = false
    wrapper = mount(SpotPanelComments)
    expect(wrapper.find('.comment-delete-btn').exists()).toBe(false)
  })

  it('shows "load older" only when expanded and hasMore is true', () => {
    store.comments = [baseComment()]
    store.commentsExpanded = true
    store.commentsHasMore = true
    wrapper = mount(SpotPanelComments)
    expect(wrapper.find('.comments-load-more').exists()).toBe(true)
    wrapper.unmount()

    store.commentsHasMore = false
    wrapper = mount(SpotPanelComments)
    expect(wrapper.find('.comments-load-more').exists()).toBe(false)
  })

  it('shows the write box when logged in, and a login prompt otherwise', () => {
    store.commentsExpanded = true
    fakeAuthStore.isLoggedIn = true
    wrapper = mount(SpotPanelComments)
    expect(wrapper.find('.comments-post-btn').exists()).toBe(true)
    expect(wrapper.find('.comments-login-link').exists()).toBe(false)
    wrapper.unmount()

    fakeAuthStore.isLoggedIn = false
    wrapper = mount(SpotPanelComments)
    expect(wrapper.find('.comments-login-link').exists()).toBe(true)
    expect(wrapper.find('.comments-post-btn').exists()).toBe(false)
  })

  it('clicking the header toggles expanded state via the store', async () => {
    store.comments = [baseComment(), baseComment({ id: 2 }), baseComment({ id: 3 }), baseComment({ id: 4 })]
    store.commentsExpanded = false
    wrapper = mount(SpotPanelComments)
    expect(store.commentsExpanded).toBe(false)

    await wrapper.get('.comments-header').trigger('click')
    expect(store.commentsExpanded).toBe(true)
  })

  it('the post button stays disabled until text is entered, and posts via the store on click', async () => {
    store.currentItem = { id: 's1', name: 'Spot', type: 'trail', latitude: 1, longitude: 1, approved: true } as any
    store.commentsExpanded = true
    fakeAuthStore.isLoggedIn = true
    vi.mocked(postComment).mockResolvedValue(baseComment({ id: 99, comment_text: 'Endlich geflowt!', user_id: 'u1' }))
    wrapper = mount(SpotPanelComments)

    const postBtn = wrapper.get('.comments-post-btn')
    expect((postBtn.element as HTMLButtonElement).disabled).toBe(true)

    const textarea = wrapper.get('.comments-input')
    await textarea.setValue('Endlich geflowt!')
    expect((postBtn.element as HTMLButtonElement).disabled).toBe(false)

    await postBtn.trigger('click')
    await flushPromises()

    expect(postComment).toHaveBeenCalledWith('s1', 'Endlich geflowt!', expect.anything())
    expect(store.comments.map(c => c.comment_text)).toContain('Endlich geflowt!')
    expect((wrapper.get('.comments-input').element as HTMLTextAreaElement).value).toBe('')
  })

  it('shows an inline error and re-enables the button when posting fails', async () => {
    store.currentItem = { id: 's1', name: 'Spot', type: 'trail', latitude: 1, longitude: 1, approved: true } as any
    store.commentsExpanded = true
    fakeAuthStore.isLoggedIn = true
    vi.mocked(postComment).mockRejectedValue(new Error('Zu viele Kommentare, bitte warte kurz.'))
    wrapper = mount(SpotPanelComments)

    await wrapper.get('.comments-input').setValue('Spam spam spam')
    await wrapper.get('.comments-post-btn').trigger('click')
    await flushPromises()

    expect(wrapper.get('.comments-error').text()).toContain('Zu viele Kommentare')
    expect((wrapper.get('.comments-post-btn').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('reply prefills the textarea with an @mention of the comment author', async () => {
    store.comments = [baseComment({ profiles: { display_name: 'Bob', avatar_url: '' } })]
    store.commentsExpanded = true
    fakeAuthStore.isLoggedIn = true
    wrapper = mount(SpotPanelComments)

    await wrapper.get('.comment-reply-btn').trigger('click')

    expect((wrapper.get('.comments-input').element as HTMLTextAreaElement).value).toBe('@Bob ')
  })

  it('delete: confirms via confirmDialog, then calls the store and removes the row on confirm', async () => {
    store.comments = [baseComment({ id: 1, user_id: 'u1' })]
    store.commentsExpanded = true
    store.commentsCurrentUserId = 'u1'
    vi.mocked(confirmDialog).mockResolvedValue(true)
    vi.mocked(deleteComment).mockResolvedValue(undefined)
    wrapper = mount(SpotPanelComments)

    await wrapper.get('.comment-delete-btn').trigger('click')
    await flushPromises()

    expect(confirmDialog).toHaveBeenCalledWith('Kommentar wirklich löschen?')
    expect(deleteComment).toHaveBeenCalledWith(1, expect.anything())
    expect(store.comments).toEqual([])
  })

  it('delete: does not call the API when the confirmation is cancelled', async () => {
    store.comments = [baseComment({ id: 1, user_id: 'u1' })]
    store.commentsExpanded = true
    store.commentsCurrentUserId = 'u1'
    vi.mocked(confirmDialog).mockResolvedValue(false)
    wrapper = mount(SpotPanelComments)

    await wrapper.get('.comment-delete-btn').trigger('click')
    await flushPromises()

    expect(deleteComment).not.toHaveBeenCalled()
    expect(store.comments).toHaveLength(1)
  })

  it('delete: shows a toast when the API call fails', async () => {
    store.comments = [baseComment({ id: 1, user_id: 'u1' })]
    store.commentsExpanded = true
    store.commentsCurrentUserId = 'u1'
    vi.mocked(confirmDialog).mockResolvedValue(true)
    vi.mocked(deleteComment).mockRejectedValue(new Error('forbidden'))
    wrapper = mount(SpotPanelComments)

    await wrapper.get('.comment-delete-btn').trigger('click')
    await flushPromises()

    expect(showToast).toHaveBeenCalled()
  })

  it('clicking the login prompt opens the auth modal via mapStore', async () => {
    store.commentsExpanded = true
    fakeAuthStore.isLoggedIn = false
    wrapper = mount(SpotPanelComments)

    await wrapper.get('.comments-login-link').trigger('click')

    expect(fakeMapStore.authModalOpen).toBe(true)
  })

  it('clicking "load older" calls loadMoreComments on the store', async () => {
    store.currentItem = { id: 's1', name: 'Spot', type: 'trail', latitude: 1, longitude: 1, approved: true } as any
    store.comments = [baseComment()]
    store.commentsExpanded = true
    store.commentsHasMore = true
    const { getOlderComments } = await import('~/communication/comments')
    vi.mocked(getOlderComments).mockResolvedValue([])
    wrapper = mount(SpotPanelComments)

    await wrapper.get('.comments-load-more').trigger('click')
    await flushPromises()

    expect(getOlderComments).toHaveBeenCalled()
  })
})
