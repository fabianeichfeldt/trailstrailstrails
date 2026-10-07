import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { renderToString } from '@vue/server-renderer'
import { createSSRApp, h } from 'vue'
import type { Trail } from '~/types/Trail'
import { TrailDetails } from '~/types/TrailDetails'

// Split out of SpotDetailInfo.test.ts as part of splitting the former
// monolithic SpotDetailInfo.vue into per-section components. New coverage
// (not in the original suite): the grayscale placeholder + overlay shown
// instead of a bare icon when the spot has no photos yet, part of the
// drastic-redesign request.
let fakeAuthStore: {
  isLoggedIn: boolean
  userId: string
  isAdmin: boolean
  uploadTrailPhoto: (file: File, trailId: string) => Promise<string>
  deleteTrailPhoto: (photo: { id: string | number; url: string }) => Promise<void>
}
let fakeMapStore: { authModalOpen: boolean }
let fakeSpotPanelStore: { photosCanModerate: boolean }

vi.stubGlobal('useAuthStore', () => fakeAuthStore)
vi.stubGlobal('useMapStore', () => fakeMapStore)
vi.stubGlobal('useSpotPanelStore', () => fakeSpotPanelStore)
vi.mock('~/map/lightbox', () => ({ bindPhotoLightbox: vi.fn() }))
vi.mock('~/utils/toast', () => ({ showToast: vi.fn() }))
vi.mock('~/map/confirmDialog', () => ({ confirmDialog: vi.fn() }))

import SpotDetailPhotos from './SpotDetailPhotos.vue'
import { confirmDialog } from '~/map/confirmDialog'
import { showToast } from '~/utils/toast'

// Client-side ClientOnly: render the default slot (what the real component
// does once mounted in the browser). Keeps the DOM assertions below
// synchronous.
const ClientOnlyClient = { setup: (_: unknown, { slots }: any) => () => slots.default?.() }

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

function mountPhotos(props: { trail: Trail; details: TrailDetails }) {
  return mount(SpotDetailPhotos, { props, global: { stubs: { ClientOnly: ClientOnlyClient } } })
}

describe('SpotDetailPhotos', () => {
  beforeEach(() => {
    fakeAuthStore = {
      isLoggedIn: false,
      userId: 'u1',
      isAdmin: false,
      uploadTrailPhoto: vi.fn(async () => 'https://example.com/photo.jpg'),
      deleteTrailPhoto: vi.fn(async () => {}),
    }
    fakeMapStore = { authModalOpen: false }
    fakeSpotPanelStore = { photosCanModerate: false }
    vi.mocked(confirmDialog).mockReset().mockResolvedValue(true)
    vi.mocked(showToast).mockReset()
  })

  it('shows the grayscale placeholder with an upload prompt when there are no photos', () => {
    const wrapper = mountPhotos({ trail: trail(), details: details() })

    expect(wrapper.find('.no-photos-visual').exists()).toBe(true)
    expect(wrapper.text()).toContain('Sei der Erste und lade ein Foto hoch')
  })

  it('shows the upload button when logged in, and the login prompt otherwise', () => {
    const loggedOut = mountPhotos({ trail: trail(), details: details() })
    expect(loggedOut.find('.photo-upload-btn').exists()).toBe(false)
    expect(loggedOut.find('.photo-login-link').exists()).toBe(true)

    fakeAuthStore.isLoggedIn = true
    const loggedIn = mountPhotos({ trail: trail(), details: details() })
    expect(loggedIn.find('.photo-upload-btn').exists()).toBe(true)
    expect(loggedIn.find('.photo-login-link').exists()).toBe(false)
  })

  it('opens the auth modal when a logged-out user clicks the login prompt', async () => {
    const wrapper = mountPhotos({ trail: trail(), details: details() })
    await wrapper.find('.photo-login-link').trigger('click')
    expect(fakeMapStore.authModalOpen).toBe(true)
  })

  it('renders the photo carousel when photos are present, not the placeholder', () => {
    const wrapper = mountPhotos({
      trail: trail(),
      details: details({ photos: [{ id: 'p1', url: 'https://example.com/1.jpg', created_at: '2024-01-01' } as any] }),
    })

    expect(wrapper.find('.no-photos-visual').exists()).toBe(false)
    expect(wrapper.find('.photo-carousel').exists()).toBe(true)
  })

  it('emits "uploaded" after a successful upload', async () => {
    fakeAuthStore.isLoggedIn = true
    const wrapper = mountPhotos({ trail: trail(), details: details() })

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await new Promise(r => setTimeout(r, 0))

    expect(fakeAuthStore.uploadTrailPhoto).toHaveBeenCalledWith(file, 't1')
    expect(wrapper.emitted('uploaded')).toBeTruthy()
  })

  // Regression: the page is prerendered (SSG) with no auth session, then
  // hydrates in the browser where the session is restored. When the
  // auth-gated upload button was a bare `v-if="authStore.isLoggedIn"`, the
  // server rendered the logged-out markup and the client the logged-in
  // markup, producing a Vue hydration node mismatch (span vs button). The
  // auth-gated controls must live inside a <ClientOnly> so the server always
  // emits the stable fallback markup regardless of store state.
  it('never renders the auth-gated upload button during SSR, even when the store says logged in', async () => {
    fakeAuthStore.isLoggedIn = true
    // SSR ClientOnly renders only its #fallback slot (Nuxt's real component
    // behaves the same on the server).
    const ClientOnlySSR = { setup: (_: unknown, { slots }: any) => () => slots.fallback?.() }
    const app = createSSRApp({
      render: () => h(SpotDetailPhotos, { trail: trail(), details: details() }),
    })
    app.component('ClientOnly', ClientOnlySSR)
    const html = await renderToString(app)

    expect(html).toContain('photo-login-link')
    expect(html).not.toContain('photo-upload-btn')
    expect(html).not.toContain('photo-fab')
  })

  // ── Photo delete ─────────────────────────────────────────────────────
  function photoDetails(overrides: Partial<{ id: string; creator: string }> = {}) {
    return details({
      photos: [{
        id: 'p1', url: 'https://example.com/1.jpg', created_at: '2024-01-01',
        creator: 'u1', profiles: { display_name: 'Alice', avatar_url: '' },
        ...overrides,
      } as any],
    })
  }

  it('credits a photo whose uploader deleted their account to "Gelöschter Nutzer"', () => {
    const wrapper = mountPhotos({ trail: trail(), details: photoDetails({ creator: null, profiles: null } as any) })
    expect(wrapper.get('.photo-uploader').text()).toBe('von Gelöschter Nutzer')
    expect(wrapper.find('.photo-delete-btn').exists()).toBe(false)
  })

  it('shows the delete button when the photo creator matches the current user', () => {
    fakeAuthStore.userId = 'u1'
    const wrapper = mountPhotos({ trail: trail(), details: photoDetails({ creator: 'u1' }) })
    expect(wrapper.find('.photo-delete-btn').exists()).toBe(true)
  })

  it('shows the delete button for an admin, regardless of creator', () => {
    fakeAuthStore.userId = 'u1'
    fakeAuthStore.isAdmin = true
    const wrapper = mountPhotos({ trail: trail(), details: photoDetails({ creator: 'someone-else' }) })
    expect(wrapper.find('.photo-delete-btn').exists()).toBe(true)
  })

  it('shows the delete button when spotPanelStore.photosCanModerate is true, regardless of creator', () => {
    fakeAuthStore.userId = 'u1'
    fakeSpotPanelStore.photosCanModerate = true
    const wrapper = mountPhotos({ trail: trail(), details: photoDetails({ creator: 'someone-else' }) })
    expect(wrapper.find('.photo-delete-btn').exists()).toBe(true)
  })

  it('hides the delete button for an unrelated logged-in user', () => {
    fakeAuthStore.userId = 'u1'
    const wrapper = mountPhotos({ trail: trail(), details: photoDetails({ creator: 'someone-else' }) })
    expect(wrapper.find('.photo-delete-btn').exists()).toBe(false)
  })

  it('confirming the delete dialog calls deleteTrailPhoto and emits photo-deleted', async () => {
    fakeAuthStore.userId = 'u1'
    vi.mocked(confirmDialog).mockResolvedValue(true)
    const wrapper = mountPhotos({ trail: trail(), details: photoDetails({ creator: 'u1' }) })

    await wrapper.find('.photo-delete-btn').trigger('click')
    await new Promise(r => setTimeout(r, 0))

    expect(fakeAuthStore.deleteTrailPhoto).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }))
    expect(wrapper.emitted('photo-deleted')).toEqual([['p1']])
  })

  it('cancelling the delete dialog does not call deleteTrailPhoto or emit', async () => {
    fakeAuthStore.userId = 'u1'
    vi.mocked(confirmDialog).mockResolvedValue(false)
    const wrapper = mountPhotos({ trail: trail(), details: photoDetails({ creator: 'u1' }) })

    await wrapper.find('.photo-delete-btn').trigger('click')
    await new Promise(r => setTimeout(r, 0))

    expect(fakeAuthStore.deleteTrailPhoto).not.toHaveBeenCalled()
    expect(wrapper.emitted('photo-deleted')).toBeFalsy()
  })

  it('shows an error toast and does not emit when deleteTrailPhoto rejects', async () => {
    fakeAuthStore.userId = 'u1'
    fakeAuthStore.deleteTrailPhoto = vi.fn().mockRejectedValue(new Error('forbidden'))
    vi.mocked(confirmDialog).mockResolvedValue(true)
    const wrapper = mountPhotos({ trail: trail(), details: photoDetails({ creator: 'u1' }) })

    await expect(wrapper.find('.photo-delete-btn').trigger('click')).resolves.not.toThrow()
    await new Promise(r => setTimeout(r, 0))

    expect(wrapper.emitted('photo-deleted')).toBeFalsy()
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('fehlgeschlagen'))
  })

  // There is exactly one delete button now (paired with the upload FAB,
  // not one per photo) — it must follow whichever photo the carousel is
  // currently showing, not any deletable photo in the list.
  it('gates the single delete button on whichever photo is currently active in the carousel', async () => {
    vi.useFakeTimers()
    try {
      fakeAuthStore.userId = 'u1'
      const wrapper = mountPhotos({
        trail: trail(),
        details: details({
          photos: [
            { id: 'p1', url: 'https://example.com/1.jpg', created_at: '2024-01-01', creator: 'someone-else', profiles: { display_name: '', avatar_url: '' } } as any,
            { id: 'p2', url: 'https://example.com/2.jpg', created_at: '2024-01-02', creator: 'u1', profiles: { display_name: '', avatar_url: '' } } as any,
          ],
        }),
      })

      // Active photo is p1 (index 0), not owned by u1 — no delete button yet.
      expect(wrapper.find('.photo-delete-btn').exists()).toBe(false)

      // Carousel auto-advances every 4s to p2 (index 1), which u1 owns.
      // advanceTimersByTimeAsync (not the sync variant) flushes microtasks
      // between ticks, so it stays safe to await without ever switching
      // back to real timers mid-test.
      await vi.advanceTimersByTimeAsync(4000)
      expect(wrapper.find('.photo-delete-btn').exists()).toBe(true)

      await wrapper.find('.photo-delete-btn').trigger('click')
      await vi.advanceTimersByTimeAsync(0)
      expect(fakeAuthStore.deleteTrailPhoto).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }))
    } finally {
      vi.useRealTimers()
    }
  })
})
