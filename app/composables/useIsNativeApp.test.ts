import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { renderToString } from 'vue/server-renderer'

const isNativePlatform = vi.fn()
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNativePlatform() } }))

import { useIsNativeApp } from './useIsNativeApp'

const Probe = defineComponent({
  setup() {
    const isNative = useIsNativeApp()
    return () => h('span', { 'data-native': String(isNative.value) })
  },
})

describe('useIsNativeApp', () => {
  beforeEach(() => isNativePlatform.mockReset())

  it('is true after mount inside the Capacitor shell', async () => {
    isNativePlatform.mockReturnValue(true)
    const wrapper = mount(Probe)
    await wrapper.vm.$nextTick()

    expect(wrapper.attributes('data-native')).toBe('true')
  })

  it('is false after mount in a normal browser', async () => {
    isNativePlatform.mockReturnValue(false)
    const wrapper = mount(Probe)
    await wrapper.vm.$nextTick()

    expect(wrapper.attributes('data-native')).toBe('false')
  })

  it('is false on the server even in a native shell, so prerendered HTML is the same for everyone', async () => {
    isNativePlatform.mockReturnValue(true)

    const html = await renderToString(h(Probe))

    expect(html).toContain('data-native="false"')
    expect(isNativePlatform).not.toHaveBeenCalled()
  })
})
