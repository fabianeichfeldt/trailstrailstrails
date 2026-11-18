// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope, ref, nextTick } from 'vue'
import { useSoilRadarIntro, INTRO_SEEN_KEY, INTRO_DWELL_MS } from './useSoilRadarIntro'

function setup(opts: { busy?: boolean; used?: boolean } = {}) {
  const busy = ref(opts.busy ?? false)
  const used = ref(opts.used ?? false)
  const scope = effectScope()
  const intro = scope.run(() => useSoilRadarIntro({ busy: () => busy.value, used: () => used.value }))!
  return { intro, busy, used, scope }
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('useSoilRadarIntro', () => {
  it('shows the callout after the dwell for a user who never saw it', () => {
    const { intro } = setup()
    intro.start()
    expect(intro.show.value).toBe(false)
    vi.advanceTimersByTime(INTRO_DWELL_MS)
    expect(intro.show.value).toBe(true)
    expect(intro.highlight.value).toBe(true)
  })

  it('never shows again once dismissed', () => {
    const first = setup()
    first.intro.start()
    vi.advanceTimersByTime(INTRO_DWELL_MS)
    first.intro.dismiss()
    expect(first.intro.show.value).toBe(false)
    expect(first.intro.highlight.value).toBe(false)
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('1')

    const second = setup()
    second.intro.start()
    vi.advanceTimersByTime(INTRO_DWELL_MS * 3)
    expect(second.intro.show.value).toBe(false)
    expect(second.intro.highlight.value).toBe(false)
  })

  it('waits while something else covers the map, then shows', async () => {
    const { intro, busy } = setup({ busy: true })
    intro.start()
    vi.advanceTimersByTime(INTRO_DWELL_MS)
    expect(intro.show.value).toBe(false)
    busy.value = false
    await nextTick()
    expect(intro.show.value).toBe(true)
  })

  it('counts using the radar as seen and drops the callout and pulse', async () => {
    const { intro, used } = setup()
    intro.start()
    vi.advanceTimersByTime(INTRO_DWELL_MS)
    used.value = true
    await nextTick()
    expect(intro.show.value).toBe(false)
    expect(intro.highlight.value).toBe(false)
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('1')
  })

  it('stays quiet for a user whose radar is already on', () => {
    const { intro } = setup({ used: true })
    intro.start()
    vi.advanceTimersByTime(INTRO_DWELL_MS)
    expect(intro.show.value).toBe(false)
    expect(intro.highlight.value).toBe(false)
  })

  it('does not fire after its scope is gone', () => {
    const { intro, scope } = setup()
    intro.start()
    scope.stop()
    vi.advanceTimersByTime(INTRO_DWELL_MS)
    expect(intro.show.value).toBe(false)
  })

  it('survives storage that throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { intro } = setup()
    intro.start()
    vi.advanceTimersByTime(INTRO_DWELL_MS)
    expect(intro.show.value).toBe(true)
    expect(() => intro.dismiss()).not.toThrow()
    spy.mockRestore()
    set.mockRestore()
  })
})

describe('useSoilRadarIntro — after engagement (experiment arm B)', () => {
  function setupB(engagedInit = false) {
    const engaged = ref(engagedInit)
    const variantB = ref(false)
    const scope = effectScope()
    const intro = scope.run(() => useSoilRadarIntro({
      busy: () => false, used: () => false,
      afterEngagement: () => variantB.value, engaged: () => engaged.value,
    }))!
    return { intro, engaged, variantB }
  }

  it('never shows on the dwell timer and keeps the pulse off until engaged', () => {
    const { intro, variantB } = setupB()
    variantB.value = true // assigned after hydration, before the map is ready
    intro.start()
    vi.advanceTimersByTime(INTRO_DWELL_MS * 5)
    expect(intro.show.value).toBe(false)
    expect(intro.highlight.value).toBe(false)
  })

  it('shows with the pulse once engaged fires after the map is up', async () => {
    const { intro, engaged, variantB } = setupB()
    variantB.value = true
    intro.start()
    engaged.value = true
    await nextTick()
    expect(intro.show.value).toBe(true)
    expect(intro.highlight.value).toBe(true)
  })

  it('shows when the visit was already engaged before the map got ready', () => {
    const { intro, variantB } = setupB(true)
    variantB.value = true
    intro.start()
    expect(intro.show.value).toBe(true)
  })

  it('a timer armed before the variant arrived does not show it in B', () => {
    const { intro, variantB } = setupB()
    intro.start()
    variantB.value = true
    vi.advanceTimersByTime(INTRO_DWELL_MS)
    expect(intro.show.value).toBe(false)
  })

  it('control (not arm B) keeps the dwell timer regardless of engagement', () => {
    const { intro } = setupB()
    intro.start()
    vi.advanceTimersByTime(INTRO_DWELL_MS)
    expect(intro.show.value).toBe(true)
  })
})
