import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useMapStore } from '~/stores/map'
import AppHeader from './AppHeader.vue'

// AppHeader.vue relies on Nuxt's implicit auto-imports (`useAuthStore`,
// `useMapStore`, `useRouter`) — see vitest.setup.ts for the global-stub
// rationale. `useAuthStore`/`useRouter` are stubbed with minimal fakes since
// the real auth store pulls in `useSupabaseClient`/`useSupabaseUser`, which
// only exist inside a live Nuxt app.
vi.stubGlobal('useMapStore', useMapStore)
vi.stubGlobal('useAuthStore', () => ({ isLoggedIn: false, avatarUrl: undefined, nickname: '', isAdmin: false, isTrailcrew: false, signOut: vi.fn() }))
vi.stubGlobal('useRouter', () => ({ push: vi.fn() }))

describe('AppHeader', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders a prominent Instagram link', () => {
    const wrapper = mount(AppHeader, { global: { stubs: { ClientOnly: true, NuxtLink: true } } })
    const link = wrapper.get('a.header-instagram')

    expect(link.attributes('href')).toBe('https://www.instagram.com/trailradar.germany')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })
})
