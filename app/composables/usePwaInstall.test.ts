// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp, defineComponent, ref } from 'vue'
import { setDeferredInstallPrompt } from './pwaInstallPrompt'

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Mount a composable inside a minimal Vue app so that onMounted / onUnmounted
 * lifecycle hooks work correctly. Returns the composable result and an unmount fn.
 */
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

function mockMatchMedia(standalone: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: standalone, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  )
}

function mockLocalStorage(dismissedAt?: number) {
  const store: Record<string, string> = {}
  if (dismissedAt !== undefined) store['pwa-dismiss'] = String(dismissedAt)
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

// ── import composable ─────────────────────────────────────────────────────────

// Dynamic import so we pick up the mocked globals in each test
async function getPwaInstall() {
  // Clear module cache so each test gets a fresh module evaluation
  const mod = await import('./usePwaInstall?t=' + Date.now())
  return mod.usePwaInstall
}

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  setDeferredInstallPrompt(null)
  // Default safe mocks
  mockMatchMedia(false)
  mockLocalStorage()
  mockUserAgent('Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/100 Mobile Safari/537.36')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('usePwaInstall', () => {
  it('already standalone — show stays false', async () => {
    mockMatchMedia(true)
    const usePwaInstall = await getPwaInstall()
    const { result, unmount } = withSetup(() => usePwaInstall())

    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(false)
    unmount()
  })

  it('dismissed within 14 days — show stays false after 8s', async () => {
    const thirteenDaysAgo = Date.now() - 13 * 24 * 60 * 60 * 1000
    mockLocalStorage(thirteenDaysAgo)
    const usePwaInstall = await getPwaInstall()
    const { result, unmount } = withSetup(() => usePwaInstall())

    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(false)
    unmount()
  })

  it('dismissed >14 days ago — show becomes true after 8s when prompt is available', async () => {
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000
    mockLocalStorage(fifteenDaysAgo)
    setDeferredInstallPrompt({ prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: 'accepted' }) } as any)
    const usePwaInstall = await getPwaInstall()
    const { result, unmount } = withSetup(() => usePwaInstall())

    expect(result.show.value).toBe(false)
    vi.advanceTimersByTime(8_000)
    expect(result.show.value).toBe(true)
    unmount()
  })

  it('fresh Android visit — prompt stashed by plugin; show true after 8s', async () => {
    setDeferredInstallPrompt({ prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: 'accepted' }) } as any)
    const usePwaInstall = await getPwaInstall()
    const { result, unmount } = withSetup(() => usePwaInstall())

    expect(result.show.value).toBe(false)
    vi.advanceTimersByTime(8_000)
    expect(result.show.value).toBe(true)
    unmount()
  })

  it('no install prompt and not iOS — banner suppressed (PWA already installed)', async () => {
    // deferredInstallPrompt stays null (set in beforeEach); non-iOS UA from beforeEach
    const usePwaInstall = await getPwaInstall()
    const { result, unmount } = withSetup(() => usePwaInstall())

    vi.advanceTimersByTime(10_000)
    expect(result.show.value).toBe(false)
    unmount()
  })

  it('iOS detection — isIos true when UA matches iPhone', async () => {
    mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15')
    const usePwaInstall = await getPwaInstall()
    const { result, unmount } = withSetup(() => usePwaInstall())

    expect(result.isIos.value).toBe(true)
    // Dwell timer still fires on iOS
    vi.advanceTimersByTime(8_000)
    expect(result.show.value).toBe(true)
    unmount()
  })

  it('iOS detection — isIos true when UA matches iPad', async () => {
    mockUserAgent('Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15')
    const usePwaInstall = await getPwaInstall()
    const { result, unmount } = withSetup(() => usePwaInstall())

    expect(result.isIos.value).toBe(true)
    unmount()
  })

  it('dismiss() — sets show false and writes timestamp to localStorage', async () => {
    const store = mockLocalStorage()
    const usePwaInstall = await getPwaInstall()
    const { result, unmount } = withSetup(() => usePwaInstall())
    setDeferredInstallPrompt({ prompt: vi.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({ outcome: 'accepted' }) } as any)

    vi.advanceTimersByTime(8_000)
    expect(result.show.value).toBe(true)

    const before = Date.now()
    result.dismiss()
    const after = Date.now()

    expect(result.show.value).toBe(false)
    const written = Number(store['pwa-dismiss'])
    expect(written).toBeGreaterThanOrEqual(before)
    expect(written).toBeLessThanOrEqual(after)
    unmount()
  })

  it('install() — calls prompt() and dismiss() on resolution', async () => {
    const usePwaInstall = await getPwaInstall()
    const { result, unmount } = withSetup(() => usePwaInstall())

    // Set after import so the cache-busted module re-evaluation doesn't reset it
    const fakePrompt = vi.fn().mockResolvedValue(undefined)
    setDeferredInstallPrompt({
      prompt: fakePrompt,
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    } as any)

    vi.advanceTimersByTime(8_000)
    expect(result.show.value).toBe(true)

    await result.install()

    expect(fakePrompt).toHaveBeenCalledOnce()
    expect(result.show.value).toBe(false)
    unmount()
  })

  it('navigate away before 8s — timer cancelled; show stays false', async () => {
    const usePwaInstall = await getPwaInstall()
    const { result, unmount } = withSetup(() => usePwaInstall())

    // Unmount before timer fires (simulates navigation)
    vi.advanceTimersByTime(4_000)
    unmount()
    vi.advanceTimersByTime(8_000) // advance well past 8s

    expect(result.show.value).toBe(false)
  })
})
