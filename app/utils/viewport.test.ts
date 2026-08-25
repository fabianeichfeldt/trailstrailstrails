import { describe, it, expect, afterEach } from 'vitest'
import { isDesktopViewport } from './viewport'

describe('isDesktopViewport', () => {
  const originalWidth = window.innerWidth

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
  })

  it('is false below the 768px breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: 767, configurable: true })
    expect(isDesktopViewport()).toBe(false)
  })

  it('is true at and above the 768px breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true })
    expect(isDesktopViewport()).toBe(true)
  })
})
