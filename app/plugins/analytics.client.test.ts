// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const state = ref<unknown>(null)
let websiteId = ''
vi.stubGlobal('defineNuxtPlugin', (fn: () => void) => fn)
vi.stubGlobal('useRuntimeConfig', () => ({ public: { umamiWebsiteId: websiteId } }))
vi.stubGlobal('useState', () => state)

const scripts = () => Array.from(document.head.querySelectorAll('script[data-website-id]'))

beforeEach(() => { document.head.innerHTML = ''; state.value = null; window.history.replaceState(null, '', '/map') })

const load = async () => (await import('./analytics.client')).default as unknown as () => void

describe('analytics plugin', () => {
  it('injects nothing without a website id', async () => {
    websiteId = ''
    ;(await load())()
    expect(scripts()).toHaveLength(0)
  })

  // The region page and third-party sites iframe /embed/*: a second script there double-counts and re-rolls the variant.
  it('injects nothing inside the /embed iframe', async () => {
    websiteId = 'site-1'
    window.history.replaceState(null, '', '/embed/abc123/?parentHost=trailradar.org')
    ;(await load())()
    expect(scripts()).toHaveLength(0)
    expect(state.value).toBeNull()
  })

  it('injects the Umami script with DNT and the variant tag, and exposes the assignment', async () => {
    websiteId = 'site-1'
    ;(await load())()
    const s = scripts()[0] as HTMLScriptElement
    expect(s.getAttribute('src')).toBe('https://stats.eichfeldt.de/script.js')
    expect(s.defer).toBe(true)
    expect(s.getAttribute('data-website-id')).toBe('site-1')
    expect(s.getAttribute('data-do-not-track')).toBe('true')
    expect(s.getAttribute('data-tag')).toMatch(/^aa-baseline:(a|b)$/)
    expect((state.value as { experimentId: string }).experimentId).toBe('aa-baseline')
  })
})
