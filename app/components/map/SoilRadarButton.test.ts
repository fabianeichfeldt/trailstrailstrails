import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive, ref, nextTick } from 'vue'
import type { FeatureAccess } from '~/entitlements/features'
import SoilRadarButton from './SoilRadarButton.vue'

// Nuxt auto-imports; stub them as the shared shapes the button reads.
const access = ref<FeatureAccess>('allowed')
let store: { enabled: boolean; status: string; toggle: ReturnType<typeof vi.fn> }
vi.stubGlobal('useFeatureAccess', () => access)
vi.stubGlobal('useSoilRadarStore', () => store)

beforeEach(() => {
  access.value = 'allowed'
  store = reactive({ enabled: false, status: 'idle', toggle: vi.fn() })
})

describe('SoilRadarButton', () => {
  it('toggles the store when allowed', async () => {
    const w = mount(SoilRadarButton)
    await w.get('button').trigger('click')
    expect(store.toggle).toHaveBeenCalledOnce()
    expect(w.emitted('teaser')).toBeUndefined()
  })

  it('emits teaser, and does not toggle, when locked', async () => {
    access.value = 'locked'
    const w = mount(SoilRadarButton)
    await w.get('button').trigger('click')
    expect(w.emitted('teaser')).toHaveLength(1)
    expect(store.toggle).not.toHaveBeenCalled()
    expect(w.classes()).toContain('is-locked')
  })

  it('queues a tap while checking and resolves it as allowed', async () => {
    access.value = 'checking'
    const w = mount(SoilRadarButton)
    await w.get('button').trigger('click')
    expect(store.toggle).not.toHaveBeenCalled()
    access.value = 'allowed'
    await nextTick()
    expect(store.toggle).toHaveBeenCalledOnce()
    expect(w.emitted('teaser')).toBeUndefined()
  })

  it('resolves a queued tap as teaser when access turns out locked', async () => {
    access.value = 'checking'
    const w = mount(SoilRadarButton)
    await w.get('button').trigger('click')
    access.value = 'locked'
    await nextTick()
    expect(w.emitted('teaser')).toHaveLength(1)
    expect(store.toggle).not.toHaveBeenCalled()
  })

  it('exposes aria-pressed and a label that follow the layer state', async () => {
    const w = mount(SoilRadarButton)
    expect(w.attributes('aria-pressed')).toBe('false')
    expect(w.attributes('aria-label')).toBe('Boden-Radar einschalten')
    store.enabled = true
    await nextTick()
    expect(w.attributes('aria-pressed')).toBe('true')
    expect(w.attributes('aria-label')).toBe('Boden-Radar ausschalten')
    expect(w.classes()).toContain('is-on')
  })

  it('labels the locked state as a Supporter feature', () => {
    access.value = 'locked'
    const w = mount(SoilRadarButton)
    expect(w.attributes('aria-label')).toContain('Supporter')
  })
})

describe('SoilRadarButton — intro highlight', () => {
  it('pulses while highlighted and the radar is off', async () => {
    const w = mount(SoilRadarButton, { props: { highlight: true } })
    expect(w.classes()).toContain('is-new')
    store.enabled = true
    await nextTick()
    expect(w.classes()).not.toContain('is-new')
  })

  it('does not pulse by default', () => {
    expect(mount(SoilRadarButton).classes()).not.toContain('is-new')
  })

  it('exposes activate(), which behaves like a tap', () => {
    access.value = 'locked'
    const w = mount(SoilRadarButton)
    ;(w.vm as unknown as { activate: () => void }).activate()
    expect(w.emitted('teaser')).toHaveLength(1)
  })
})
