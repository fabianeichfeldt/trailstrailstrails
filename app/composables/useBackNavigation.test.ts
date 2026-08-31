// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBackNavigation } from './useBackNavigation'

const back = vi.fn()
const navigateTo = vi.fn()

beforeEach(() => {
  back.mockClear()
  navigateTo.mockClear()
  vi.stubGlobal('useRouter', () => ({ back }))
  vi.stubGlobal('navigateTo', navigateTo)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function setHistoryBack(value: string | null) {
  window.history.replaceState({ ...(window.history.state ?? {}), back: value }, '')
}

describe('useBackNavigation', () => {
  it('calls router.back() when there is in-app history', () => {
    setHistoryBack('/map')

    useBackNavigation().goBack()

    expect(back).toHaveBeenCalledOnce()
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('navigates to the fallback when opened cold (no in-app history)', () => {
    setHistoryBack(null)

    useBackNavigation().goBack('/map')

    expect(navigateTo).toHaveBeenCalledWith('/map')
    expect(back).not.toHaveBeenCalled()
  })

  it('defaults the fallback to /map', () => {
    setHistoryBack(null)

    useBackNavigation().goBack()

    expect(navigateTo).toHaveBeenCalledWith('/map')
  })
})
