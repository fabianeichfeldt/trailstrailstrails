import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useMapStore } from '~/stores/map'
import { useFiltersStore } from '~/stores/filters'
import Drawer from './Drawer.vue'

// Drawer.vue relies on Nuxt's implicit auto-imports (`useMapStore`,
// `useFiltersStore`, `useAuthStore`) — see vitest.setup.ts for the
// global-stub rationale. `useAuthStore` is stubbed with a minimal fake since
// the real store pulls in `useSupabaseClient`/`useSupabaseUser`, which only
// exist inside a live Nuxt app.
vi.stubGlobal('useMapStore', useMapStore)
vi.stubGlobal('useFiltersStore', useFiltersStore)
vi.stubGlobal('useAuthStore', () => ({ isLoggedIn: false, nickname: '', signOut: vi.fn() }))

describe('Drawer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders a prominent Instagram link regardless of drawer open state', () => {
    const wrapper = mount(Drawer, { global: { stubs: { NuxtLink: true } } })
    const link = wrapper.get('a.drawer-instagram')

    expect(link.attributes('href')).toBe('https://www.instagram.com/trailradar.germany')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })
})
