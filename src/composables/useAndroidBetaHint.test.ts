// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp, defineComponent } from 'vue'
import { bottomBannerActive } from './bottomBannerSlot'

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T
  const app = createApp(
    defineComponent({
      setup() {
        result = composable()
        return {}
      },
      template: '<div/>',
    }),
  )
  const el = document.createElement('div')
  app.mount(el)
  return { result, unmount: () => app.unmount() }
}

function mockLocalStorage(entries: Record<string, string> = {}) {
  const store: Record<string, string> = { ...entries }
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    _store: store,
  })
  return store
}

function mockUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, writable: true, configurable: true })
}

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/100 Mobile Safari/537.36'
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'

async function getUseAndroidBetaHint() {
  const mod = await import('./useAndroidBetaHint?t=' + Date.now())
  return mod.useAndroidBetaHint
}

beforeEach(() => {
  vi.useFakeTimers()
  bottomBannerActive.value = false
  mockLocalStorage()
  mockUserAgent(ANDROID_UA)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useAndroidBetaHint', () => {
  it('non-Android UA — show stays false', async () => {
    mockUserAgent(IOS_UA)
    const useAndroidBetaHint = await getUseAndroidBetaHint()
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(15_000)
    expect(result.show.value).toBe(false)
    unmount()
  })

  it('already signed up — show stays false', async () => {
    mockLocalStorage({ 'android-beta-signed-up': '1' })
    const useAndroidBetaHint = await getUseAndroidBetaHint()
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(15_000)
    expect(result.show.value).toBe(false)
    unmount()
  })

  it('dismissed within 14 days — show stays false', async () => {
    const thirteenDaysAgo = Date.now() - 13 * 24 * 60 * 60 * 1000
    mockLocalStorage({ 'android-beta-hint-dismiss': String(thirteenDaysAgo) })
    const useAndroidBetaHint = await getUseAndroidBetaHint()
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(15_000)
    expect(result.show.value).toBe(false)
    unmount()
  })

  it('dismissed >14 days ago — show becomes true after dwell', async () => {
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000
    mockLocalStorage({ 'android-beta-hint-dismiss': String(fifteenDaysAgo) })
    const useAndroidBetaHint = await getUseAndroidBetaHint()
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(true)
    unmount()
  })

  it('fresh Android visit — show becomes true after dwell', async () => {
    const useAndroidBetaHint = await getUseAndroidBetaHint()
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    expect(result.show.value).toBe(false)
    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(true)
    unmount()
  })

  it('bottom-sheet slot occupied — show stays false, does not steal the slot', async () => {
    bottomBannerActive.value = true
    const useAndroidBetaHint = await getUseAndroidBetaHint()
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(false)
    expect(bottomBannerActive.value).toBe(true)
    unmount()
  })

  it('shows itself — claims the bottom-sheet slot', async () => {
    const useAndroidBetaHint = await getUseAndroidBetaHint()
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(true)
    expect(bottomBannerActive.value).toBe(true)
    unmount()
  })

  it('dismiss() — hides, frees the slot, and persists the timestamp', async () => {
    const store = mockLocalStorage()
    const useAndroidBetaHint = await getUseAndroidBetaHint()
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(true)

    const before = Date.now()
    result.dismiss()
    const after = Date.now()

    expect(result.show.value).toBe(false)
    expect(bottomBannerActive.value).toBe(false)
    const written = Number(store['android-beta-hint-dismiss'])
    expect(written).toBeGreaterThanOrEqual(before)
    expect(written).toBeLessThanOrEqual(after)
    unmount()
  })

  it('navigate away before dwell fires — timer cancelled; show stays false', async () => {
    const useAndroidBetaHint = await getUseAndroidBetaHint()
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(4_000)
    unmount()
    vi.advanceTimersByTime(10_000)

    expect(result.show.value).toBe(false)
  })
})
