import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

// No gate is alive here (no spot page, no /map): the sweep must not depend on one.
let auth = reactive({ userId: 'u1' })
vi.stubGlobal('useAuthStore', () => auth)
// Hoisted: the plugin calls it at import time.
vi.hoisted(() => { (globalThis as Record<string, unknown>).defineNuxtPlugin = (setup: () => void) => setup })

import plugin from './paidCacheSweep.client'

const TRAIL = 'tr_wx_v3_trail_t1'
const SOIL = 'tr_soil_v2'

function seed() {
  localStorage.setItem(TRAIL, JSON.stringify({ uid: 'u1', at: Date.now(), data: {} }))
  localStorage.setItem(SOIL, JSON.stringify({ uid: 'u1', at: Date.now(), data: {} }))
  localStorage.setItem('soil-radar-range', 'kept')
}

beforeEach(() => {
  localStorage.clear()
  auth = reactive({ userId: 'u1' })
  ;(plugin as unknown as () => void)()
  seed()
})

describe('paid-cache sweep', () => {
  it('a sign-out anywhere in the app removes every paid feature\'s cache', async () => {
    auth.userId = ''
    await nextTick()
    expect(localStorage.getItem(TRAIL)).toBeNull()
    expect(localStorage.getItem(SOIL)).toBeNull()
    expect(localStorage.getItem('soil-radar-range')).toBe('kept')
  })

  it('an account switch removes them too', async () => {
    auth.userId = 'u2'
    await nextTick()
    expect(localStorage.getItem(TRAIL)).toBeNull()
    expect(localStorage.getItem(SOIL)).toBeNull()
  })

  it('auth resolving on page load (no user → user) keeps them', async () => {
    auth = reactive({ userId: '' })
    ;(plugin as unknown as () => void)()
    auth.userId = 'u1'
    await nextTick()
    expect(localStorage.getItem(TRAIL)).not.toBeNull()
    expect(localStorage.getItem(SOIL)).not.toBeNull()
  })
})
