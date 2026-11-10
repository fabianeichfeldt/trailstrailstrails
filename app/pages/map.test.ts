// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { onBeforeUnmount, reactive, ref } from 'vue'

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('useSeoMeta', vi.fn())
vi.stubGlobal('useHead', vi.fn())
vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
vi.stubGlobal('useRoute', () => ({ query: {} }))
vi.stubGlobal('useAuthStore', () => reactive({ isLoggedIn: false }))
vi.stubGlobal('useMapStore', () => reactive({ authModalOpen: false, userLocation: null }))
vi.stubGlobal('useTrailsStore', () => reactive({ all: [] }))
vi.stubGlobal('useSoilRadarStore', () => reactive({ enabled: false, failure: null, mode: null }))
vi.stubGlobal('useSoilRadarIntro', () => ({
  highlight: ref(false), show: ref(false), dismiss: vi.fn(), start: vi.fn(),
}))

import MapPage from './map.vue'

const startAddMode = vi.fn()
const cancelAddMode = vi.fn()
const MapViewStub = {
  name: 'MapView',
  emits: ['addMode', 'ready', 'nearbyConflict', 'spotPicked'],
  setup(_: unknown, { expose }: { expose: (e: Record<string, unknown>) => void }) {
    expose({ startAddMode, cancelAddMode })
    return {}
  },
  template: '<div class="map-view-stub" />',
}

const mountPage = () => mount(MapPage, {
  global: {
    stubs: {
      ClientOnly: { template: '<div><slot /></div>' },
      MapView: MapViewStub,
      SearchBar: true, UserAvatar: true, SoilRadarButton: true, SoilRadarIntro: true,
      SoilRadarPanel: true, SoilRadarLockedSheet: true, Drawer: true, NearbyModal: true,
      AddSpotModal: true, AuthModal: true, ReportErrorModal: true,
    },
  },
})

beforeEach(() => {
  startAddMode.mockClear()
  cancelAddMode.mockClear()
})

describe('map page add-spot FAB', () => {
  it('clicking + opens the menu and marks the button active', async () => {
    const w = mountPage()
    expect(w.get('#fab-menu').classes()).toContain('hidden')
    expect(w.get('#add-btn').classes()).not.toContain('active')

    await w.get('#add-btn').trigger('click')

    expect(w.get('#fab-menu').classes()).not.toContain('hidden')
    expect(w.get('#add-btn').classes()).toContain('active')
  })

  it('picking a menu item starts add mode for that type and closes the menu', async () => {
    const w = mountPage()
    await w.get('#add-btn').trigger('click')

    await w.get('.fab-item[data-type="bikepark"]').trigger('click')

    expect(startAddMode).toHaveBeenCalledWith('bikepark')
    expect(w.get('#fab-menu').classes()).toContain('hidden')
  })

  it('in add mode the button shows the hint, stays active, and a click cancels add mode', async () => {
    const w = mountPage()
    await w.getComponent(MapViewStub).vm.$emit('addMode', 'trail')

    const btn = w.get('#add-btn')
    expect(btn.text()).toBe('Klick auf Karte, um Trail zu setzen')
    expect(btn.classes()).toContain('active')

    await btn.trigger('click')
    expect(cancelAddMode).toHaveBeenCalledTimes(1)
  })

  it('leaving add mode restores the + label', async () => {
    const w = mountPage()
    const mv = w.getComponent(MapViewStub)
    await mv.vm.$emit('addMode', 'trail')
    await mv.vm.$emit('addMode', undefined)

    expect(w.get('#add-btn').text()).toBe('+')
    expect(w.get('#add-btn').classes()).not.toContain('active')
  })
})

describe('map page locate FAB', () => {
  it('reports locate_me to Umami', async () => {
    const umami = vi.fn()
    window.umami = { track: umami }
    const w = mountPage()

    await w.get('.location-btn').trigger('click')

    expect(umami).toHaveBeenCalledWith('locate_me', { located: false })
    delete window.umami
  })
})
