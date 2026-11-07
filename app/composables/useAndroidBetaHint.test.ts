// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAndroidBetaHint } from './useAndroidBetaHint'
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
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(15_000)
    expect(result.show.value).toBe(false)
    unmount()
  })

  it('already signed up — show stays false', async () => {
    mockLocalStorage({ 'android-beta-signed-up': '1' })
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(15_000)
    expect(result.show.value).toBe(false)
    unmount()
  })

  it('dismissed within 3 days — show stays false', async () => {
    const twoDays = Date.now() - 2 * 24 * 60 * 60 * 1000
    mockLocalStorage({ 'android-beta-hint-dismiss': String(twoDays) })
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(15_000)
    expect(result.show.value).toBe(false)
    unmount()
  })

  it('dismissed >3 days ago — show becomes true after dwell', async () => {
    const fifeDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000
    mockLocalStorage({ 'android-beta-hint-dismiss': String(fifeDaysAgo) })
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(true)
    unmount()
  })

  it('fresh Android visit — show becomes true after dwell', async () => {
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    expect(result.show.value).toBe(false)
    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(true)
    unmount()
  })

  it('bottom-sheet slot occupied — show stays false, does not steal the slot', async () => {
    bottomBannerActive.value = true
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(false)
    expect(bottomBannerActive.value).toBe(true)
    unmount()
  })

  it('shows itself — claims the bottom-sheet slot', async () => {
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(true)
    expect(bottomBannerActive.value).toBe(true)
    unmount()
  })

  it('dismiss() — hides, frees the slot, and persists the timestamp', async () => {
    const store = mockLocalStorage()
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
    const { result, unmount } = withSetup(() => useAndroidBetaHint())

    vi.advanceTimersByTime(4_000)
    unmount()
    vi.advanceTimersByTime(10_000)

    expect(result.show.value).toBe(false)
  })
})

const DAY = 24 * 60 * 60 * 1000

describe('useAndroidBetaHint — decisions', () => {
  it('shows exactly at 10s, not before', () => {
    const { result, unmount } = withSetup(() => useAndroidBetaHint())
    vi.advanceTimersByTime(9_999)
    expect(result.show.value).toBe(false)
    expect(bottomBannerActive.value).toBe(false)
    vi.advanceTimersByTime(1)
    expect(result.show.value).toBe(true)
    unmount()
  })

  it('Android UA match is case-insensitive', () => {
    mockUserAgent('Mozilla/5.0 (Linux; ANDROID 12)')
    const { result, unmount } = withSetup(() => useAndroidBetaHint())
    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(true)
    unmount()
  })

  it('non-Android starts no timer', () => {
    mockUserAgent(IOS_UA)
    const { unmount } = withSetup(() => useAndroidBetaHint())
    expect(vi.getTimerCount()).toBe(0)
    unmount()
  })

  it('signed-up or recently dismissed start no timer', () => {
    mockLocalStorage({ 'android-beta-signed-up': '1' })
    let r = withSetup(() => useAndroidBetaHint())
    expect(vi.getTimerCount()).toBe(0)
    r.unmount()

    mockLocalStorage({ 'android-beta-hint-dismiss': String(Date.now() - DAY) })
    r = withSetup(() => useAndroidBetaHint())
    expect(vi.getTimerCount()).toBe(0)
    r.unmount()
  })

  it('3-day dismissal window: 3d - 1s suppresses, exactly 3d shows again', () => {
    mockLocalStorage({ 'android-beta-hint-dismiss': String(Date.now() - (3 * DAY - 1000)) })
    let r = withSetup(() => useAndroidBetaHint())
    vi.advanceTimersByTime(10_000)
    expect(r.result.show.value).toBe(false)
    r.unmount()

    mockLocalStorage({ 'android-beta-hint-dismiss': String(Date.now() - 3 * DAY) })
    r = withSetup(() => useAndroidBetaHint())
    vi.advanceTimersByTime(10_000)
    expect(r.result.show.value).toBe(true)
    r.unmount()
  })

  it('slot occupied at fire time: stays hidden even if freed afterwards', () => {
    const { result, unmount } = withSetup(() => useAndroidBetaHint())
    bottomBannerActive.value = true // another banner claims it during the dwell
    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(false)
    bottomBannerActive.value = false
    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(false)
    unmount()
  })

  it('dismiss() stores a string timestamp under the dismiss key and survives remount', () => {
    const setItem = vi.fn()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem })
    const { result, unmount } = withSetup(() => useAndroidBetaHint())
    result.dismiss()
    expect(setItem).toHaveBeenCalledWith('android-beta-hint-dismiss', String(Date.now()))
    unmount()

    mockLocalStorage({ 'android-beta-hint-dismiss': String(Date.now()) })
    const b = withSetup(() => useAndroidBetaHint())
    vi.advanceTimersByTime(10_000)
    expect(b.result.show.value).toBe(false)
    b.unmount()
  })

  it('reads the signed-up and dismiss keys', () => {
    const getItem = vi.fn().mockReturnValue(null)
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() })
    const { unmount } = withSetup(() => useAndroidBetaHint())
    expect(getItem).toHaveBeenCalledWith('android-beta-signed-up')
    expect(getItem).toHaveBeenCalledWith('android-beta-hint-dismiss')
    unmount()
  })

  it('unmount clears the pending timer', () => {
    const { unmount } = withSetup(() => useAndroidBetaHint())
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
