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
  uploadTrailPhoto: (file: File, trailId: string) => Promise<string>
}
let fakeMapStore: { authModalOpen: boolean }

vi.stubGlobal('useAuthStore', () => fakeAuthStore)
vi.stubGlobal('useMapStore', () => fakeMapStore)
vi.mock('~/map/lightbox', () => ({ bindPhotoLightbox: vi.fn() }))
vi.mock('~/utils/toast', () => ({ showToast: vi.fn() }))

import SpotDetailPhotos from './SpotDetailPhotos.vue'

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
    fakeAuthStore = { isLoggedIn: false, uploadTrailPhoto: vi.fn(async () => 'https://example.com/photo.jpg') }
    fakeMapStore = { authModalOpen: false }
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
})
